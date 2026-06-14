const prisma = require('../utils/db');

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
 * POST /settlements
 * Records a direct peer-to-peer payment to settle balances.
 */
exports.createSettlement = async (req, res) => {
  try {
    const {
      payerId,
      receiverId,
      amount,
      currency,
      exchangeRate,
      date,
      groupId
    } = req.body;

    // 1. Validation
    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required.' });
    }
    if (!payerId || !receiverId) {
      return res.status(400).json({ error: 'Payer and receiver IDs are required.' });
    }
    if (payerId === receiverId) {
      return res.status(400).json({ error: 'Payer and receiver cannot be the same person.' });
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Settlement amount must be a positive number.' });
    }

    const settlementDate = date ? new Date(date) : new Date();

    // 2. Verify both payer and receiver were active group members on that date
    const isPayerActive = await validateMemberOnDate(groupId, payerId, settlementDate);
    if (!isPayerActive) {
      return res.status(400).json({ error: 'The payer was not an active member of this group on the settlement date.' });
    }

    const isReceiverActive = await validateMemberOnDate(groupId, receiverId, settlementDate);
    if (!isReceiverActive) {
      return res.status(400).json({ error: 'The receiver was not an active member of this group on the settlement date.' });
    }

    // 3. Create Settlement
    const settlement = await prisma.settlement.create({
      data: {
        payerId,
        receiverId,
        amount: numAmount,
        currency: currency || 'INR',
        exchangeRate: exchangeRate ? Number(exchangeRate) : 1.0,
        date: settlementDate,
        groupId
      }
    });

    return res.status(201).json({
      message: 'Settlement recorded successfully.',
      settlement
    });

  } catch (error) {
    console.error('Create Settlement Error:', error);
    return res.status(500).json({ error: 'Failed to record settlement.' });
  }
};

/**
 * GET /groups/:id/settlements
 * Lists all settlements for a group.
 */
exports.getGroupSettlements = async (req, res) => {
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

    // 2. Fetch settlements
    const settlements = await prisma.settlement.findMany({
      where: { groupId },
      include: {
        payer: {
          select: { id: true, name: true, email: true }
        },
        receiver: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    // Format output
    const formatted = settlements.map(set => ({
      id: set.id,
      amount: set.amount,
      currency: set.currency,
      exchangeRate: set.exchangeRate,
      date: set.date,
      payerId: set.payerId,
      payerName: set.payer.name,
      receiverId: set.receiverId,
      receiverName: set.receiver.name,
      createdAt: set.createdAt
    }));

    return res.json(formatted);
  } catch (error) {
    console.error('Get Group Settlements Error:', error);
    return res.status(500).json({ error: 'Failed to retrieve settlements.' });
  }
};
