const pool = require('../config/database');
const occurrencesModel = require('../models/occurrencesModel');
const occurrenceReopensModel = require('../models/occurrenceReopensModel');
const occurrenceStatusHistoryModel = require('../models/occurrenceStatusHistoryModel');
const categoriesModel = require('../models/categoriesModel');
const subcategoriesModel = require('../models/subcategoriesModel');
const neighborhoodsModel = require('../models/neighborhoodsModel');
const evaluationsService = require('./evaluationsService');
const occurrenceMediaService = require('./occurrenceMediaService');
const { assertWithinEditWindow } = require('../utils/occurrenceEditWindow');

const ANTIDUPLICITY_RADIUS_M = 500;

// Máquina de estados das ocorrências. Cada chave é um status e o valor lista os
// status para os quais ele pode transitar. 'closed' é terminal — a reabertura
// acontece via POST /reopen, que cria uma NOVA ocorrência (não muda este status).
// O valor 'reopened' existe no enum do banco por legado, mas foi descontinuado:
// não é selecionável nem alvo de transição.
const STATUS_TRANSITIONS = {
  pending: ['awaiting_validation', 'closed'],
  awaiting_validation: ['validated', 'closed'],
  validated: ['in_analysis', 'closed'],
  in_analysis: ['in_progress', 'closed'],
  in_progress: ['resolved', 'closed'],
  resolved: ['resolution_validated', 'resolution_rejected'],
  resolution_rejected: ['in_progress', 'closed'],
  resolution_validated: ['closed'],
  closed: [],
};

// Lista única de status selecionáveis pela aplicação (fonte da verdade para as
// validações dos controllers). Deriva da máquina de estados, então nunca inclui
// 'reopened'.
const OCCURRENCE_STATUSES = Object.keys(STATUS_TRANSITIONS);

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
  } else {
    // Geofencing: bairro não informado -> deriva da localização (point-in-polygon).
    // Fica null se o ponto não cair em nenhum bairro cadastrado.
    const located = await neighborhoodsModel.findByPoint(data.longitude, data.latitude);
    data.neighborhood_id = located ? located.id : null;
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

  // Cria a ocorrência e registra o estado inicial do histórico (NULL -> status
  // inicial) na mesma transação, para que toda ocorrência tenha trilha completa.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const occurrence = await occurrencesModel.create(data, client);
    await occurrenceStatusHistoryModel.create(
      {
        occurrence_id: occurrence.id,
        old_status: null,
        new_status: occurrence.status,
        changed_by: occurrence.author_id,
      },
      client
    );
    await client.query('COMMIT');
    return occurrence;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Valida e aplica uma transição de status conforme a máquina de estados,
// gravando a mudança em occurrence_status_history. Retorna null se a ocorrência
// não existir; lança INVALID_STATUS_TRANSITION se a transição não for permitida.
const updateOccurrenceStatus = async (id, status, { user } = {}) => {
  const existing = await occurrencesModel.findById(id);
  if (!existing) return null;

  assertCanManageLifecycle(existing, user, 'change its status');

  const allowed = STATUS_TRANSITIONS[existing.status] || [];
  if (!allowed.includes(status)) {
    const err = new Error(
      `Cannot change status from '${existing.status}' to '${status}'`
    );
    err.code = 'INVALID_STATUS_TRANSITION';
    err.details = { from: existing.status, to: status, allowed };
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await occurrencesModel.updateStatus(id, status, client);
    await occurrenceStatusHistoryModel.create(
      {
        occurrence_id: id,
        old_status: existing.status,
        new_status: status,
        changed_by: user?.id ?? null,
      },
      client
    );
    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Autorização das ações de ciclo de vida (mudança de status e reabertura):
// permitido para órgãos (agent), admins ou o cidadão autor da ocorrência.
const assertCanManageLifecycle = (occurrence, user, action) => {
  const isAuthor = user && occurrence.author_id === user.id;
  const isAdmin = user && user.role === 'admin';
  const isAgent = user && user.role === 'agent';
  if (!isAuthor && !isAdmin && !isAgent) {
    const err = new Error(
      `Only the occurrence author, an agency or an admin can ${action}`
    );
    err.code = 'FORBIDDEN';
    throw err;
  }
};

// Autorização da edição de campos: somente o autor da ocorrência ou um admin.
const assertCanEdit = (occurrence, user) => {
  const isAuthor = user && occurrence.author_id === user.id;
  const isAdmin = user && user.role === 'admin';
  if (!isAuthor && !isAdmin) {
    const err = new Error('Only the occurrence author or an admin can edit it');
    err.code = 'FORBIDDEN';
    throw err;
  }
};

// Edição dos campos da ocorrência, permitida apenas dentro da janela de 24h a
// partir da criação (ver occurrenceEditWindow). Retorna null se não existir.
const updateOccurrence = async (id, patch, { user } = {}) => {
  const existing = await occurrencesModel.findById(id);
  if (!existing) return null;

  assertCanEdit(existing, user);
  assertWithinEditWindow(existing);

  return occurrencesModel.update(id, patch);
};

// Exclusão de ocorrência: somente o autor ou um admin podem excluir. O autor
// só pode excluir dentro da janela de 24h a partir da criação (ver
// occurrenceEditWindow); o admin pode excluir a qualquer momento.
const deleteOccurrence = async (id, { user } = {}) => {
  const existing = await occurrencesModel.findById(id);
  if (!existing) return false;

  const isAuthor = user && existing.author_id === user.id;
  const isAdmin = user && user.role === 'admin';
  if (!isAuthor && !isAdmin) {
    const err = new Error('Only the occurrence author or an admin can delete it');
    err.code = 'FORBIDDEN';
    throw err;
  }
  if (!isAdmin) {
    assertWithinEditWindow(existing);
  }

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
              author_id,
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

    assertCanManageLifecycle(original, user, 'reopen it');

    if (!FINALIZED_STATUSES.includes(original.status)) {
      const err = new Error('Only resolved or closed occurrences can be reopened');
      err.code = 'OCCURRENCE_NOT_REOPENABLE';
      throw err;
    }

    // Só a ponta da cadeia pode ser reaberta: se esta ocorrência já tem uma
    // sucessora (alguém já a reabriu), a reabertura deve partir da última da
    // cadeia, não desta. A checagem roda sob o FOR UPDATE acima, então duas
    // reaberturas concorrentes da mesma ocorrência são serializadas — a segunda
    // enxerga a filha criada pela primeira e é barrada.
    const { rows: successors } = await client.query(
      `SELECT id FROM occurrences WHERE parent_occurrence_id = $1 LIMIT 1`,
      [occurrenceId]
    );
    if (successors.length > 0) {
      const err = new Error(
        'This occurrence has already been reopened; reopen the latest occurrence in the chain'
      );
      err.code = 'OCCURRENCE_ALREADY_REOPENED';
      err.details = { latest_occurrence_id: successors[0].id };
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

    // Estado inicial da nova ocorrência no histórico (NULL -> pending).
    await occurrenceStatusHistoryModel.create(
      {
        occurrence_id: newOccurrence.id,
        old_status: null,
        new_status: newOccurrence.status,
        changed_by: user.id,
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

// Histórico de mudanças de status de uma ocorrência. Retorna null se a
// ocorrência não existir.
const getStatusHistory = async (occurrenceId) => {
  const occurrence = await occurrencesModel.findById(occurrenceId);
  if (!occurrence) return null;
  return occurrenceStatusHistoryModel.findByOccurrence(occurrenceId);
};

module.exports = {
  listOccurrences,
  getOccurrenceById,
  listNearbyOccurrences,
  createOccurrence,
  updateOccurrenceStatus,
  updateOccurrence,
  deleteOccurrence,
  reopenOccurrence,
  getReopenHistory,
  getStatusHistory,
  OCCURRENCE_STATUSES,
  STATUS_TRANSITIONS,
  ANTIDUPLICITY_RADIUS_M,
};
