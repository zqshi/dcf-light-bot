const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ALLOWED_MIME = /^(image\/(png|jpeg|gif|webp|svg\+xml)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation))|text\/plain)$/;
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function buildUploadRouter(config, requirePermission) {
  const router = express.Router();
  const uploadDir = path.join(String(config.dataDir || process.cwd()), 'uploads');

  // Ensure upload directory exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.bin';
      const id = crypto.randomUUID();
      cb(null, `${id}${ext}`);
    }
  });

  const upload = multer({
    storage,
    limits: { fileSize: MAX_SIZE },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIME.test(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`unsupported file type: ${file.mimetype}. allowed: images, PDF, Office documents, plain text.`));
      }
    }
  });

  // POST /api/control/uploads
  router.post('/', requirePermission('control:document:write'), (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ success: false, error: { message: err.message } });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, error: { message: 'no file uploaded' } });
      }
      const fileId = path.basename(req.file.filename);
      res.status(201).json({
        success: true,
        file: {
          id: fileId,
          url: `/api/control/uploads/${fileId}`,
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      });
    });
  });

  // GET /api/control/uploads/:fileId
  router.get('/:fileId', (req, res) => {
    const fileId = path.basename(String(req.params.fileId || ''));
    const filePath = path.join(uploadDir, fileId);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: { message: 'file not found' } });
    }
    res.sendFile(filePath);
  });

  return router;
}

module.exports = { buildUploadRouter };
