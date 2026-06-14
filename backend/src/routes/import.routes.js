const express = require('express');
const multer = require('multer');
const importController = require('../controllers/import.controller');
const authenticateToken = require('../middleware/auth.middleware');

const router = express.Router();
// Use memory storage for buffer parsing
const upload = multer({ storage: multer.memoryStorage() });

// Apply authentication to all import routes
router.use(authenticateToken);

router.post('/', upload.single('file'), importController.uploadCSV);
router.get('/:id/report', importController.getImportReport);
router.post('/:id/resolve', importController.resolveSession);

module.exports = router;
