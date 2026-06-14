const prisma = require('../utils/db');
const balanceService = require('../services/balance.service');

/**
 * GET /groups/:id/balances
 * Retrieves net balances and optimized settlement suggestions for a group.
 */
exports.getBalances = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const userId = req.user.id;

    // 1. Verify requesting user belongs to the group
    const membership = await prisma.groupMember.findFirst({
      where: { groupId, userId }
    });

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group.' });
    }

    // 2. Fetch group balances from service
    const results = await balanceService.calculateGroupBalances(groupId);

    return res.json(results);
  } catch (error) {
    console.error('Get Balances Error:', error);
    return res.status(500).json({ error: 'Failed to retrieve group balances.' });
  }
};
