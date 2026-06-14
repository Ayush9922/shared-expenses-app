const express = require('express');
const settlementController = require('../controllers/settlement.controller');
const authenticateToken = require('../middleware/auth.middleware');

const router = express.Router();

// Apply auth middleware to all settlement endpoints
router.use(authenticateToken);

router.post('/', settlementController.createSettlement);

module.exports = router;
