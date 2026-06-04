const fs = require('fs');
const occurrenceMediaModel = require('../models/occurrenceMediaModel');
const occurrencesModel = require('../models/occurrencesModel');
const storage = require('../config/storage');

// Monta a representação pública de uma linha de mídia (com url servível).
const toPublic = (row) => ({
  id: row.id,
  occurrence_id: row.occurrence_id,
  url: storage.publicUrlForStorageKey(row.storage_key),
  storage_key: row.storage_key,
  original_name: row.original_name,
  mime_type: row.mime_type,
  size_bytes: Number(row.size_bytes),
  uploaded_by: row.uploaded_by,
  created_at: row.created_at,
});

// Anexa 1..N arquivos (já gravados no disco pelo multer) a uma ocorrência.
// Ponto central da issue: em qualquer falha, apagamos os arquivos para não
// deixar órfãos no disco.
const addMedia = async ({ occurrenceId, files, userId }) => {
  try {
    const occurrence = await occurrencesModel.findById(occurrenceId);
    if (!occurrence) {
      const err = new Error('Occurrence not found');
      err.code = 'OCCURRENCE_NOT_FOUND';
      throw err;
    }

    const created = [];
    for (const file of files) {
      const row = await occurrenceMediaModel.create({
        occurrence_id: occurrenceId,
        storage_key: storage.storageKeyForFilename(file.filename),
        original_name: file.originalname,
        mime_type: file.mimetype,
        size_bytes: file.size,
        uploaded_by: userId ?? null,
      });
      created.push(toPublic(row));
    }
    return created;
  } catch (err) {
    // Rollback do disco: remove tudo que o multer gravou nesta requisição.
    await storage.removeFiles(files);
    throw err;
  }
};

const listMedia = async (occurrenceId) => {
  const rows = await occurrenceMediaModel.findByOccurrenceId(occurrenceId);
  return rows.map(toPublic);
};

// Remove uma mídia: apaga a linha e, em seguida, o arquivo do disco.
const removeMedia = async ({ occurrenceId, mediaId }) => {
  const media = await occurrenceMediaModel.findById(mediaId);
  if (!media || media.occurrence_id !== occurrenceId) {
    return false;
  }

  await occurrenceMediaModel.remove(mediaId);
  await fs.promises
    .unlink(storage.absolutePathForStorageKey(media.storage_key))
    .catch(() => {});
  return true;
};

// Limpeza de disco ao excluir a ocorrência inteira: o CASCADE remove as linhas
// no banco, mas os bytes precisam ser apagados aqui. Buscar as chaves ANTES de
// excluir a ocorrência.
const collectStorageKeys = async (occurrenceId) => {
  const rows = await occurrenceMediaModel.findByOccurrenceId(occurrenceId);
  return rows.map((r) => r.storage_key);
};

const removeFilesByStorageKeys = async (storageKeys = []) => {
  await Promise.all(
    storageKeys.map((key) =>
      fs.promises
        .unlink(storage.absolutePathForStorageKey(key))
        .catch(() => {})
    )
  );
};

module.exports = {
  addMedia,
  listMedia,
  removeMedia,
  collectStorageKeys,
  removeFilesByStorageKeys,
};
