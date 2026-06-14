const prisma = require('../utils/db');
const splitService = require('../services/split.service');

/**
 * Helper to check if a user is/was an active group member on a given date.
 */
const validateMemberOnDate = async (groupId, userId, dateString) => {
  const targetDate = new Date(dateString);

  // Retrieve memberships for user in this group
  const memberships = await prisma.groupMember.findMany({
    where: { groupId, userId }
  });

  if (memberships.length === 0) return false;

  // Check if any membership window covers the target date
  return memberships.some(m => {
    const joined = new Date(m.joinedAt);
    const left = m.leftAt ? new Date(m.leftAt) : null;
    return targetDate >= joined && (!left || targetDate <= left);
  });
};

/**
 * POST /expenses
 * Creates a new expense and splits it among participants.
 */
exports.createExpense = async (req, res) => {
  try {
    const {
      title,
      description,
      amount,
      currency,
      exchangeRate,
      date,
      paidBy,
      groupId,
      splitType,
      splits
    } = req.body;

    const createdBy = req.user.id;

    // 1. Validation
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required.' });
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number.' });
    }
    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required.' });
    }
    if (!paidBy) {
      return res.status(400).json({ error: 'Payer is required.' });
    }
    if (!splitType || !['EQUAL', 'EXACT', 'PERCENTAGE'].includes(splitType)) {
      return res.status(400).json({ error: 'A valid split type (EQUAL, EXACT, PERCENTAGE) is required.' });
    }
    if (!splits || splits.length === 0) {
      return res.status(400).json({ error: 'Split participants are required.' });
    }

    const expenseDate = date ? new Date(date) : new Date();

    // 2. Verify Payer was a member of the group on the expense date
    const isPayerActive = await validateMemberOnDate(groupId, paidBy, expenseDate);
    if (!isPayerActive) {
      return res.status(400).json({ error: 'The payer was not an active member of this group on the expense date.' });
    }

    // 3. Extract participant user IDs to check timeline memberships
    const participantIds = splitType === 'EQUAL' 
      ? splits 
      : splits.map(s => s.userId);

    // 4. Verify all participants were members of the group on the expense date
    for (const userId of participantIds) {
      const isMemberActive = await validateMemberOnDate(groupId, userId, expenseDate);
      if (!isMemberActive) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        return res.status(400).json({
          error: `${user?.name || 'A participant'} was not an active member of this group on the expense date.`
        });
      }
    }

    // 5. Calculate shares using Split Service
    let participantShares;
    try {
      participantShares = splitService.calculateSplits(splitType, numAmount, splits);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    // 6. Save to Database in a transaction
    const newExpense = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          title: title.trim(),
          description: description ? description.trim() : null,
          amount: numAmount,
          currency: currency || 'INR',
          exchangeRate: exchangeRate ? Number(exchangeRate) : 1.0,
          date: expenseDate,
          paidBy,
          groupId,
          createdBy
        }
      });

      // Create participant records
      const participantData = participantShares.map(share => ({
        expenseId: expense.id,
        userId: share.userId,
        amountOwed: share.amountOwed,
        splitType,
        splitValue: share.splitValue
      }));

      await tx.expenseParticipant.createMany({
        data: participantData
      });

      return expense;
    });

    return res.status(201).json({
      message: 'Expense created successfully.',
      expense: newExpense
    });

  } catch (error) {
    console.error('Create Expense Error:', error);
    return res.status(500).json({ error: 'Failed to create expense.' });
  }
};

/**
 * PUT /expenses/:id
 * Updates an existing expense and updates split records.
 */
exports.updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      amount,
      currency,
      exchangeRate,
      date,
      paidBy,
      splitType,
      splits
    } = req.body;

    // 1. Check if expense exists
    const existingExpense = await prisma.expense.findUnique({
      where: { id }
    });

    if (!existingExpense) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    const groupId = existingExpense.groupId;
    const expenseDate = date ? new Date(date) : existingExpense.date;
    const numAmount = amount ? Number(amount) : Number(existingExpense.amount);
    const targetPaidBy = paidBy || existingExpense.paidBy;
    const targetSplitType = splitType || 'EQUAL';

    // 2. Verify Payer was active
    const isPayerActive = await validateMemberOnDate(groupId, targetPaidBy, expenseDate);
    if (!isPayerActive) {
      return res.status(400).json({ error: 'The payer was not an active member of this group on the expense date.' });
    }

    // 3. Verify participants were active
    if (splits && splits.length > 0) {
      const participantIds = targetSplitType === 'EQUAL' ? splits : splits.map(s => s.userId);
      for (const userId of participantIds) {
        const isMemberActive = await validateMemberOnDate(groupId, userId, expenseDate);
        if (!isMemberActive) {
          const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
          return res.status(400).json({
            error: `${user?.name || 'A participant'} was not an active member of this group on the expense date.`
          });
        }
      }
    }

    // 4. Calculate splits
    let participantShares = null;
    if (splits && splits.length > 0) {
      try {
        participantShares = splitService.calculateSplits(targetSplitType, numAmount, splits);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    // 5. Update Database transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Update basic fields
      const updatedExpense = await tx.expense.update({
        where: { id },
        data: {
          title: title ? title.trim() : existingExpense.title,
          description: description !== undefined ? (description ? description.trim() : null) : existingExpense.description,
          amount: numAmount,
          currency: currency || existingExpense.currency,
          exchangeRate: exchangeRate ? Number(exchangeRate) : existingExpense.exchangeRate,
          date: expenseDate,
          paidBy: targetPaidBy
        }
      });

      // Update participants if splits were sent
      if (participantShares) {
        // Delete old records
        await tx.expenseParticipant.deleteMany({
          where: { expenseId: id }
        });

        // Insert new records
        const participantData = participantShares.map(share => ({
          expenseId: id,
          userId: share.userId,
          amountOwed: share.amountOwed,
          splitType: targetSplitType,
          splitValue: share.splitValue
        }));

        await tx.expenseParticipant.createMany({
          data: participantData
        });
      }

      return updatedExpense;
    });

    return res.json({
      message: 'Expense updated successfully.',
      expense: updated
    });

  } catch (error) {
    console.error('Update Expense Error:', error);
    return res.status(500).json({ error: 'Failed to update expense.' });
  }
};

/**
 * DELETE /expenses/:id
 * Deletes an expense (Cascade deletes participants).
 */
exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const existingExpense = await prisma.expense.findUnique({
      where: { id }
    });

    if (!existingExpense) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    await prisma.expense.delete({
      where: { id }
    });

    return res.json({ message: 'Expense deleted successfully.' });
  } catch (error) {
    console.error('Delete Expense Error:', error);
    return res.status(500).json({ error: 'Failed to delete expense.' });
  }
};

/**
 * GET /groups/:id/expenses
 * Lists all expenses for a group, including split participant shares.
 */
exports.getGroupExpenses = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const userId = req.user.id;

    // 1. Verify user belongs to the group
    const membership = await prisma.groupMember.findFirst({
      where: { groupId, userId }
    });

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group.' });
    }

    // 2. Fetch expenses
    const expenses = await prisma.expense.findMany({
      where: { groupId },
      include: {
        payer: {
          select: { id: true, name: true, email: true }
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    // Format response
    const formatted = expenses.map(exp => ({
      id: exp.id,
      title: exp.title,
      description: exp.description,
      amount: exp.amount,
      currency: exp.currency,
      exchangeRate: exp.exchangeRate,
      date: exp.date,
      paidById: exp.paidBy,
      paidByName: exp.payer.name,
      createdAt: exp.createdAt,
      participants: exp.participants.map(part => ({
        userId: part.userId,
        name: part.user.name,
        email: part.user.email,
        amountOwed: part.amountOwed,
        splitType: part.splitType,
        splitValue: part.splitValue
      }))
    }));

    return res.json(formatted);
  } catch (error) {
    console.error('Get Group Expenses Error:', error);
    return res.status(500).json({ error: 'Failed to retrieve expenses.' });
  }
};
