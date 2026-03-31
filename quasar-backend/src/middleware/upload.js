/**
 * Multer upload middleware – stores files in memory (no disk write).
 * Max file size: 10 MB per file.
 */
const multer = require('multer');

const storage = multer.memoryStorage();

const pdfFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter: pdfFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

module.exports = upload;
