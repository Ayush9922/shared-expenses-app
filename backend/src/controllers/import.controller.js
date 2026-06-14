const prisma = require('../utils/db');
const importService = require('../services/import.service');

/**
 * POST /imports
 * Uploads a CSV file, parses it, and creates an ImportSession with detected issues.
 */
exports.uploadCSV = async (req, res) => {
  try {
    const { groupId } = req.body;
    const userId = req.user.id;

    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a CSV file.' });
    }

    // Verify requesting user is member of group
    const membership = await prisma.groupMember.findFirst({
      where: { groupId, userId }
    });

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group.' });
    }

    const session = await importService.processCSVUpload(
      req.file.buffer,
      req.file.originalname,
      userId,
      groupId
    );

    return res.status(201).json({
      message: 'CSV file uploaded and parsed successfully.',
      session
    });
  } catch (error) {
    console.error('Upload CSV Error:', error);
    return res.status(500).json({ error: 'Failed to process CSV file.' });
  }
};

/**
 * GET /imports/:id/report
 * Retrieves the anomaly detection report for an ImportSession.
 */
exports.getImportReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const session = await prisma.importSession.findUnique({
      where: { id },
      include: {
        issues: true
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Import session not found.' });
    }

    // Verify ownership/membership
    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied to this import report.' });
    }

    return res.json(session);
  } catch (error) {
    console.error('Get Import Report Error:', error);
    return res.status(500).json({ error: 'Failed to retrieve import report.' });
  }
};

/**
 * POST /imports/:id/resolve
 * Finalizes the CSV import session after applying user-approved resolutions for issues.
 */
exports.resolveSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutions, groupId } = req.body;
    const userId = req.user.id;

    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required to finalize import.' });
    }

    // Verify membership
    const membership = await prisma.groupMember.findFirst({
      where: { groupId, userId }
    });

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group.' });
    }

    const result = await importService.finalizeCSVImport(
      id,
      resolutions,
      groupId,
      userId
    );

    return res.json({
      message: 'CSV import finalized successfully.',
      importedCount: result.count
    });
  } catch (error) {
    console.error('Resolve Session Error:', error);
    return res.status(400).json({ error: error.message || 'Failed to resolve import session.' });
  }
};
