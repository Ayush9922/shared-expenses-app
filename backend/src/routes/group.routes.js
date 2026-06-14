const express = require('express');
const groupController = require('../controllers/group.controller');
const expenseController = require('../controllers/expense.controller');
const settlementController = require('../controllers/settlement.controller');
const balanceController = require('../controllers/balance.controller');
const authenticateToken = require('../middleware/auth.middleware');

const router = express.Router();

// Apply auth middleware to all group management endpoints
router.use(authenticateToken);

router.get('/', groupController.getGroups);
router.post('/', groupController.createGroup);
router.get('/:id', groupController.getGroupDetails);
router.post('/:id/members', groupController.addMember);
router.delete('/:id/members/:memberId', groupController.removeMember);

// Expense routing mapped under groups
router.get('/:id/expenses', expenseController.getGroupExpenses);

// Settlement routing mapped under groups
router.get('/:id/settlements', settlementController.getGroupSettlements);

// Balance routing mapped under groups
router.get('/:id/balances', balanceController.getBalances);

module.exports = router;



