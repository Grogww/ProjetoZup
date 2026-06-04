const fs = require('fs');
const path = require('path');

// Diretório raiz dos uploads (fora de src/, ignorado pelo git, montado em volume no Docker).
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || 'uploads');

// Subpasta das mídias de ocorrências, relativa ao UPLOAD_DIR.
const OCCURRENCES_SUBDIR = 'occurrences';

// URL base pública usada para montar a url servível das mídias.
// Vazia => url relativa (ex.: /uploads/occurrences/<arquivo>), o que serve bem para o front.
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 10;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const MAX_FILES_PER_REQUEST = Number(process.env.MAX_UPLOAD_FILES) || 5;

// Allowlist de mimetypes. SVG fica de fora de propósito (risco de XSS ao ser servido).
const ALLOWED_MIME_TYPES = (
  process.env.ALLOWED_MIME_TYPES ||
  'image/jpeg,image/png,image/webp,image/gif'
)
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);

// Extensão derivada do mimetype (nunca confiamos no nome original no path).
const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

const isAllowedMimeType = (mimetype) => ALLOWED_MIME_TYPES.includes(mimetype);

const extensionForMimeType = (mimetype) => MIME_EXTENSIONS[mimetype] || 'bin';

// storage_key é o caminho relativo ao UPLOAD_DIR, sempre com '/'.
const storageKeyForFilename = (filename) => `${OCCURRENCES_SUBDIR}/${filename}`;

const absolutePathForStorageKey = (storageKey) =>
  path.join(UPLOAD_DIR, storageKey);

const publicUrlForStorageKey = (storageKey) =>
  `${PUBLIC_BASE_URL}/uploads/${storageKey}`;

// Garante que os diretórios existam ao iniciar a aplicação.
const ensureDirs = () => {
  fs.mkdirSync(path.join(UPLOAD_DIR, OCCURRENCES_SUBDIR), { recursive: true });
};

// Remove arquivos do disco ignorando erros (usado para limpeza/rollback).
const removeFiles = async (files = []) => {
  await Promise.all(
    files.map((file) =>
      fs.promises.unlink(file.path).catch(() => {})
    )
  );
};

ensureDirs();

module.exports = {
  UPLOAD_DIR,
  OCCURRENCES_SUBDIR,
  PUBLIC_BASE_URL,
  MAX_UPLOAD_MB,
  MAX_UPLOAD_BYTES,
  MAX_FILES_PER_REQUEST,
  ALLOWED_MIME_TYPES,
  isAllowedMimeType,
  extensionForMimeType,
  storageKeyForFilename,
  absolutePathForStorageKey,
  publicUrlForStorageKey,
  removeFiles,
};
