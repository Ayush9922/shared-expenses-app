const express = require('express');
const expenseController = require('../controllers/expense.controller');
const authenticateToken = require('../middleware/auth.middleware');

const router = express.Router();

// Apply auth middleware to all expense endpoints
router.use(authenticateToken);

router.post('/', expenseController.createExpense);
router.put('/:id', expenseController.updateExpense);
router.delete('/:id', expenseController.deleteExpense);

module.exports = router;
