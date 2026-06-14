const prisma = require('../utils/db');

/**
 * POST /groups
 * Creates a new group. The creator is automatically added as the first member.
 */
exports.createGroup = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.id;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Group name is required.' });
    }

    // Run as a transaction so that group creation and member assignment are atomic
    const group = await prisma.$transaction(async (tx) => {
      // 1. Create the Group
      const newGroup = await tx.group.create({
        data: {
          name: name.trim(),
          createdBy: userId
        }
      });

      // 2. Add creator to GroupMember
      await tx.groupMember.create({
        data: {
          groupId: newGroup.id,
          userId: userId,
          joinedAt: new Date()
        }
      });

      return newGroup;
    });

    return res.status(201).json({
      message: 'Group created successfully.',
      group
    });
  } catch (error) {
    console.error('Create Group Error:', error);
    return res.status(500).json({ error: 'Failed to create group.' });
  }
};

/**
 * GET /groups
 * Retrieves all groups that the authenticated user is currently an active member of.
 */
exports.getGroups = async (req, res) => {
  try {
    const userId = req.user.id;

    // Retrieve memberships that are active (leftAt is null)
    // or retrieve all groups they have ever been part of.
    // Let's fetch groups where the user is an active member.
    const activeMemberships = await prisma.groupMember.findMany({
      where: {
        userId: userId,
        leftAt: null // Only active memberships
      },
      include: {
        group: {
          include: {
            creator: {
              select: { id: true, name: true, email: true }
            },
            members: {
              where: { leftAt: null },
              include: {
                user: {
                  select: { id: true, name: true, email: true }
                }
              }
            }
          }
        }
      },
      orderBy: {
        joinedAt: 'desc'
      }
    });

    const groups = activeMemberships.map(membership => {
      const g = membership.group;
      return {
        id: g.id,
        name: g.name,
        createdBy: g.createdBy,
        creatorName: g.creator.name,
        createdAt: g.createdAt,
        memberCount: g.members.length,
        joinedAt: membership.joinedAt
      };
    });

    return res.json(groups);
  } catch (error) {
    console.error('Get Groups Error:', error);
    return res.status(500).json({ error: 'Failed to retrieve groups.' });
  }
};

/**
 * GET /groups/:id
 * Retrieves details for a specific group, including its members and membership history timeline.
 */
exports.getGroupDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 1. Verify that the requesting user is a member of the group (active or historic)
    const membershipCheck = await prisma.groupMember.findFirst({
      where: {
        groupId: id,
        userId: userId
      }
    });

    if (!membershipCheck) {
      return res.status(403).json({ error: 'You are not a member of this group.' });
    }

    // 2. Fetch Group Details with members (both active and inactive)
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: {
            joinedAt: 'asc'
          }
        }
      }
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    // Structure response to distinguish between active members and historic timeline
    const activeMembers = group.members
      .filter(m => m.leftAt === null)
      .map(m => ({
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        joinedAt: m.joinedAt
      }));

    const membershipHistory = group.members.map(m => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      joinedAt: m.joinedAt,
      leftAt: m.leftAt
    }));

    return res.json({
      id: group.id,
      name: group.name,
      createdBy: group.createdBy,
      creatorName: group.creator.name,
      createdAt: group.createdAt,
      activeMembers,
      membershipHistory
    });
  } catch (error) {
    console.error('Get Group Details Error:', error);
    return res.status(500).json({ error: 'Failed to retrieve group details.' });
  }
};

/**
 * POST /groups/:id/members
 * Adds a new member to the group by their email address.
 * Handles membership timeline checks (e.g. if they previously left, they can re-join).
 */
exports.addMember = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const { email } = req.body;
    const requesterId = req.user.id;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    // 1. Verify requester is an active member of this group
    const activeRequester = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: requesterId,
        leftAt: null
      }
    });

    if (!activeRequester) {
      return res.status(403).json({ error: 'Only active group members can add new members.' });
    }

    // 2. Find target user by email
    const targetUser = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() }
    });

    if (!targetUser) {
      return res.status(404).json({ error: `User with email ${email} not found.` });
    }

    // 3. Check if user is already an active member
    const existingActiveMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: targetUser.id,
        leftAt: null
      }
    });

    if (existingActiveMember) {
      return res.status(400).json({ error: `${targetUser.name} is already an active member of this group.` });
    }

    // 4. Add new member (creates a new membership history record)
    const newMember = await prisma.groupMember.create({
      data: {
        groupId,
        userId: targetUser.id,
        joinedAt: new Date()
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return res.status(201).json({
      message: `${targetUser.name} added to the group successfully.`,
      member: {
        userId: newMember.user.id,
        name: newMember.user.name,
        email: newMember.user.email,
        joinedAt: newMember.joinedAt
      }
    });
  } catch (error) {
    console.error('Add Group Member Error:', error);
    return res.status(500).json({ error: 'Failed to add group member.' });
  }
};

/**
 * DELETE /groups/:id/members/:memberId
 * Removes a member from the group.
 * Does NOT delete the database record, but sets leftAt = now to preserve timeline history.
 */
exports.removeMember = async (req, res) => {
  try {
    const { id: groupId, memberId } = req.params;
    const requesterId = req.user.id;

    // 1. Verify requester is an active member of this group
    const activeRequester = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: requesterId,
        leftAt: null
      }
    });

    if (!activeRequester) {
      return res.status(403).json({ error: 'Only active group members can remove members.' });
    }

    // 2. Find the active membership record for the target member
    const activeMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: memberId,
        leftAt: null
      },
      include: {
        user: { select: { name: true } }
      }
    });

    if (!activeMembership) {
      return res.status(404).json({ error: 'Active group membership not found for this user.' });
    }

    // 3. Mark the membership as left (soft remove)
    await prisma.groupMember.update({
      where: { id: activeMembership.id },
      data: { leftAt: new Date() }
    });

    return res.json({
      message: `${activeMembership.user.name} removed from the group successfully.`
    });
  } catch (error) {
    console.error('Remove Group Member Error:', error);
    return res.status(500).json({ error: 'Failed to remove group member.' });
  }
};
