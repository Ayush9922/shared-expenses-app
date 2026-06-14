const express = require('express');
const authController = require('../controllers/auth.controller');

const router = express.Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

module.exports = router;
