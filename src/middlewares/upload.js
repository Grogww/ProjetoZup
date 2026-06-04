const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const storage = require('../config/storage');

const FIELD_NAME = 'media';

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(storage.UPLOAD_DIR, storage.OCCURRENCES_SUBDIR));
  },
  // Nome gerado pelo servidor: aleatório + extensão derivada do mimetype.
  // Nunca usamos o nome original no caminho de disco.
  filename: (req, file, cb) => {
    const random = crypto.randomBytes(16).toString('hex');
    const ext = storage.extensionForMimeType(file.mimetype);
    cb(null, `${random}.${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (!storage.isAllowedMimeType(file.mimetype)) {
    const err = new Error(
      `Unsupported file type "${file.mimetype}". Allowed: ${storage.ALLOWED_MIME_TYPES.join(', ')}`
    );
    err.code = 'INVALID_MIME_TYPE';
    return cb(err);
  }
  cb(null, true);
};

const upload = multer({
  storage: diskStorage,
  fileFilter,
  limits: {
    fileSize: storage.MAX_UPLOAD_BYTES,
    files: storage.MAX_FILES_PER_REQUEST,
  },
});

const arrayHandler = upload.array(FIELD_NAME, storage.MAX_FILES_PER_REQUEST);

// Envolve o multer para traduzir seus erros em respostas JSON limpas e
// limpar arquivos já gravados quando a requisição é rejeitada.
const uploadOccurrenceMedia = (req, res, next) => {
  arrayHandler(req, res, async (err) => {
    if (!err) return next();

    await storage.removeFiles(req.files || []);

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res
          .status(413)
          .json({ error: `Each file must be at most ${storage.MAX_UPLOAD_MB}MB` });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res
          .status(400)
          .json({ error: `At most ${storage.MAX_FILES_PER_REQUEST} files allowed per request` });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res
          .status(400)
          .json({ error: `Unexpected file field. Use "${FIELD_NAME}"` });
      }
      return res.status(400).json({ error: err.message });
    }

    if (err.code === 'INVALID_MIME_TYPE') {
      return res.status(415).json({ error: err.message });
    }

    return next(err);
  });
};

module.exports = { uploadOccurrenceMedia, FIELD_NAME };
