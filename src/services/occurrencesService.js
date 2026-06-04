const pool = require('../config/database');
const occurrencesModel = require('../models/occurrencesModel');
const occurrenceReopensModel = require('../models/occurrenceReopensModel');
const categoriesModel = require('../models/categoriesModel');
const subcategoriesModel = require('../models/subcategoriesModel');
const neighborhoodsModel = require('../models/neighborhoodsModel');
const evaluationsService = require('./evaluationsService');
const occurrenceMediaService = require('./occurrenceMediaService');

const ANTIDUPLICITY_RADIUS_M = 500;

// Status finalizados: não bloqueiam a criação de uma nova ocorrência próxima
// (uma já resolvida/fechada pode reincidir) e são os elegíveis para reabertura.
const FINALIZED_STATUSES = ['resolved', 'closed'];

const listOccurrences = async (filters) => {
  return occurrencesModel.findAll(filters);
};

const getOccurrenceById = async (id, { userId } = {}) => {
  const occurrence = await occurrencesModel.findById(id);
  if (!occurrence) return null;

  const voted_user = userId
    ? await evaluationsService.getUserVote(userId, id)
    : null;

  const media = await occurrenceMediaService.listMedia(id);

  return { ...occurrence, voted_user, media };
};

const listNearbyOccurrences = async ({ latitude, longitude, radius_m }) => {
  return occurrencesModel.findNearby({
    latitude,
    longitude,
    radius_m: radius_m ?? ANTIDUPLICITY_RADIUS_M,
  });
};

const createOccurrence = async (data) => {
  const category = await categoriesModel.findById(data.category_id);
  if (!category) {
    const err = new Error('Category not found');
    err.code = 'CATEGORY_NOT_FOUND';
    throw err;
  }

  if (data.subcategory_id !== undefined && data.subcategory_id !== null) {
    const subcategory = await subcategoriesModel.findById(data.subcategory_id);
    if (!subcategory) {
      const err = new Error('Subcategory not found');
      err.code = 'SUBCATEGORY_NOT_FOUND';
      throw err;
    }
    if (subcategory.category_id !== data.category_id) {
      const err = new Error('Subcategory does not belong to the given category');
      err.code = 'SUBCATEGORY_CATEGORY_MISMATCH';
      throw err;
    }
  }

  if (data.neighborhood_id !== undefined && data.neighborhood_id !== null) {
    const neighborhood = await neighborhoodsModel.findById(data.neighborhood_id);
    if (!neighborhood) {
      const err = new Error('Neighborhood not found');
      err.code = 'NEIGHBORHOOD_NOT_FOUND';
      throw err;
    }
  }

  if (data.parent_occurrence_id !== undefined && data.parent_occurrence_id !== null) {
    const parent = await occurrencesModel.findById(data.parent_occurrence_id);
    if (!parent) {
      const err = new Error('Parent occurrence not found');
      err.code = 'PARENT_OCCURRENCE_NOT_FOUND';
      throw err;
    }
  }

  const nearby = await occurrencesModel.findNearby({
    latitude: data.latitude,
    longitude: data.longitude,
    radius_m: ANTIDUPLICITY_RADIUS_M,
  });
  const duplicate = nearby.find(
    (o) =>
      o.category_id === data.category_id &&
      !FINALIZED_STATUSES.includes(o.status)
  );
  if (duplicate) {
    const err = new Error('A similar open occurrence already exists within 500m');
    err.code = 'OCCURRENCE_DUPLICATE';
    err.details = { duplicate_id: duplicate.id, distance_m: duplicate.distance_m };
    throw err;
  }

  return occurrencesModel.create(data);
};

const updateOccurrenceStatus = async (id, status) => {
  const existing = await occurrencesModel.findById(id);
  if (!existing) return null;
  return occurrencesModel.updateStatus(id, status);
};

const deleteOccurrence = async (id) => {
  const existing = await occurrencesModel.findById(id);
  if (!existing) return false;

  // O CASCADE remove as linhas de occurrence_media, mas não os bytes em disco.
  // Coletamos as chaves antes de excluir e apagamos os arquivos depois.
  const storageKeys = await occurrenceMediaService.collectStorageKeys(id);

  let deleted;
  try {
    deleted = await occurrencesModel.remove(id);
  } catch (err) {
    if (err.code === '23503') {
      const conflict = new Error('Occurrence is referenced by other records');
      conflict.code = 'OCCURRENCE_IN_USE';
      throw conflict;
    }
    throw err;
  }

  if (deleted) {
    await occurrenceMediaService.removeFilesByStorageKeys(storageKeys);
  }
  return deleted;
};

// Reabre uma ocorrência finalizada (RF17): cria uma NOVA ocorrência vinculada
// à anterior e grava uma linha de auditoria em occurrence_reopens. A ocorrência
// original não muda de status — fica como registro do ciclo anterior.
// Tudo em uma única transação (nova ocorrência + auditoria são atômicas).
const reopenOccurrence = async ({ occurrenceId, user, reason, overrides = {} }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Trava a original e já traz lat/lng para copiar a geometria.
    const { rows } = await client.query(
      `SELECT id,
              title,
              description,
              ST_X(location) AS longitude,
              ST_Y(location) AS latitude,
              address,
              category_id,
              subcategory_id,
              neighborhood_id,
              status,
              reopen_count,
              root_occurrence_id
         FROM occurrences
        WHERE id = $1
        FOR UPDATE`,
      [occurrenceId]
    );
    const original = rows[0];
    if (!original) {
      const err = new Error('Occurrence not found');
      err.code = 'OCCURRENCE_NOT_FOUND';
      throw err;
    }

    if (!FINALIZED_STATUSES.includes(original.status)) {
      const err = new Error('Only resolved or closed occurrences can be reopened');
      err.code = 'OCCURRENCE_NOT_REOPENABLE';
      throw err;
    }

    // Raiz da cadeia: a original já tinha raiz? então mantém; senão a própria
    // original vira a raiz do problema recorrente.
    const root = original.root_occurrence_id ?? original.id;
    const reopenSequence = original.reopen_count + 1;

    // Cria a nova ocorrência copiando os dados da original, com overrides
    // opcionais. assigned_organization_id fica nulo de propósito: a reincidência
    // passa por re-triagem.
    const newOccurrence = await occurrencesModel.create(
      {
        title: overrides.title ?? original.title,
        description: overrides.description ?? original.description,
        latitude: overrides.latitude ?? original.latitude,
        longitude: overrides.longitude ?? original.longitude,
        address: overrides.address ?? original.address,
        category_id: original.category_id,
        subcategory_id: original.subcategory_id,
        neighborhood_id: original.neighborhood_id,
        author_id: user.id,
        assigned_organization_id: null,
        parent_occurrence_id: original.id,
        root_occurrence_id: root,
        reopen_count: reopenSequence,
        status: 'pending',
      },
      client
    );

    const reopen = await occurrenceReopensModel.create(
      {
        original_occurrence_id: original.id,
        new_occurrence_id: newOccurrence.id,
        root_occurrence_id: root,
        reopened_by: user.id,
        reason,
        previous_status: original.status,
        reopen_sequence: reopenSequence,
      },
      client
    );

    await client.query('COMMIT');
    return { occurrence: newOccurrence, reopen };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Histórico de reincidência de um problema, a partir de qualquer ocorrência da
// cadeia. Retorna null se a ocorrência não existir.
const getReopenHistory = async (occurrenceId) => {
  const occurrence = await occurrencesModel.findById(occurrenceId);
  if (!occurrence) return null;

  const root = occurrence.root_occurrence_id ?? occurrence.id;
  return occurrenceReopensModel.findByRoot(root);
};

module.exports = {
  listOccurrences,
  getOccurrenceById,
  listNearbyOccurrences,
  createOccurrence,
  updateOccurrenceStatus,
  deleteOccurrence,
  reopenOccurrence,
  getReopenHistory,
  ANTIDUPLICITY_RADIUS_M,
};
