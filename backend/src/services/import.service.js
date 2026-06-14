const prisma = require('../utils/db');
const splitService = require('./split.service');

/**
 * Custom robust CSV Parser.
 * Splits lines and handles quoted strings containing commas.
 */
const parseCSV = (csvContent) => {
  const lines = csvContent.split(/\r?\n/);
  if (lines.length === 0 || !lines[0].trim()) return [];

  // Parse headers and strip quotes
  const headers = splitCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = splitCSVLine(line);
    const row = {};
    headers.forEach((header, index) => {
      // Normalize header keys (e.g. paid_by -> paidBy or keep as is)
      const cleanHeader = header.trim().toLowerCase();
      row[cleanHeader] = values[index] !== undefined ? values[index] : '';
    });
    rows.push({ rowIndex: i, data: row });
  }
  return rows;
};

const splitCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ''));
  return result;
};

/**
 * Robust date parser supporting DD-MM-YYYY and custom unparseable string checks (e.g., 'Mar-14')
 */
const parseCSVDate = (dateStr) => {
  if (!dateStr || !dateStr.trim()) return null;
  
  const clean = dateStr.trim();
  
  // 1. Check if DD-MM-YYYY format
  const parts = clean.split('-');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    const year = parseInt(parts[2], 10);
    
    // Check if it's a 4 digit year
    if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 1000) {
      return new Date(year, month, day);
    }
  }

  // 2. Fallback to default Date parser
  const d = new Date(clean);
  if (!isNaN(d.getTime())) return d;

  return null;
};

/**
 * Case-insensitive User Resolver.
 * Maps names (e.g. Aisha, priya) and emails to registered users.
 */
const resolveUser = async (identifier) => {
  if (!identifier || !identifier.trim()) return null;
  const clean = identifier.trim();
  return await prisma.user.findFirst({
    where: {
      OR: [
        { email: clean.toLowerCase() },
        { name: { equals: clean, mode: 'insensitive' } }
      ]
    }
  });
};

/**
 * Checks if a user was an active member of a group on a given date.
 */
const checkMemberOnDate = async (groupId, userId, date) => {
  const memberships = await prisma.groupMember.findMany({
    where: { groupId, userId }
  });
  if (memberships.length === 0) return false;
  return memberships.some(m => {
    const joined = new Date(m.joinedAt);
    const left = m.leftAt ? new Date(m.leftAt) : null;
    return date >= joined && (!left || date <= left);
  });
};

/**
 * Parses split definitions from split_with and split_details.
 * Returns Array<{ name: string, value: number | null }>
 */
const parseParticipants = (splitWith, splitDetails, splitType) => {
  const type = splitType ? splitType.trim().toLowerCase() : 'equal';
  
  // If equal split, parse split_with directly
  if (type === 'equal' || !splitDetails || !splitDetails.trim()) {
    if (!splitWith || !splitWith.trim()) return [];
    return splitWith.split(';').map(s => ({ name: s.trim(), value: null })).filter(s => s.name);
  }

  // Parse split_details e.g. "Rohan 700; Priya 400; Meera 400" or "Aisha 30%"
  const tokens = splitDetails.split(';').map(t => t.trim()).filter(Boolean);
  return tokens.map(token => {
    // Split by space
    const lastSpaceIdx = token.lastIndexOf(' ');
    if (lastSpaceIdx === -1) {
      // No space, try to strip % and return
      const cleanVal = token.replace(/%/g, '').trim();
      return { name: token.trim(), value: isNaN(Number(cleanVal)) ? null : Number(cleanVal) };
    }
    const name = token.substring(0, lastSpaceIdx).trim();
    const valStr = token.substring(lastSpaceIdx + 1).replace(/%/g, '').trim();
    return {
      name,
      value: isNaN(Number(valStr)) ? null : Number(valStr)
    };
  });
};

/**
 * Anomaly Detection Engine.
 * Scans a single CSV row and returns a list of detected issues/warnings/errors.
 */
const detectAnomalies = async (row, groupId) => {
  const issues = [];
  const { date, description, paid_by, amount, currency, split_type, split_with, split_details, notes } = row.data;

  const numAmount = Number(amount);
  const parsedDate = parseCSVDate(date);

  // Rule 1: Empty Required Fields
  if (!description || !description.trim()) {
    issues.push({
      issueType: 'EMPTY_FIELD',
      fieldName: 'description',
      message: 'Description is empty.',
      severity: 'ERROR'
    });
  }
  if (amount === undefined || amount === '') {
    issues.push({
      issueType: 'EMPTY_FIELD',
      fieldName: 'amount',
      message: 'Amount is empty.',
      severity: 'ERROR'
    });
  }
  if (!paid_by || !paid_by.trim()) {
    issues.push({
      issueType: 'EMPTY_FIELD',
      fieldName: 'paid_by',
      message: 'Payer name is empty.',
      severity: 'ERROR'
    });
  }

  // Rule 2: Negative Amounts
  if (amount && numAmount < 0) {
    issues.push({
      issueType: 'NEGATIVE_AMOUNT',
      fieldName: 'amount',
      message: `Amount (${amount}) is negative.`,
      severity: 'ERROR'
    });
  }

  // Rule 3: Invalid Date Format (e.g. Mar-14 or blank)
  if (!parsedDate) {
    issues.push({
      issueType: 'INVALID_DATE',
      fieldName: 'date',
      message: `Date "${date}" is invalid. Dates must be in DD-MM-YYYY format.`,
      severity: 'ERROR'
    });
  }

  // Rule 4: Settlement Recorded as Expense
  const settlementKeywords = ['settle', 'payment', 'paid back', 'refund', 'repay', 'settlement'];
  const isSettlementDescription = description && settlementKeywords.some(keyword => description.toLowerCase().includes(keyword));
  const isSettlementNote = notes && settlementKeywords.some(keyword => notes.toLowerCase().includes(keyword));
  const isSettlementSplit = !split_type && split_with && !split_with.includes(';');

  if (isSettlementDescription || isSettlementNote || isSettlementSplit) {
    issues.push({
      issueType: 'SETTLEMENT_AS_EXPENSE',
      fieldName: 'description',
      message: 'Transaction description, notes, or split definition suggests this is a direct settlement payment.',
      severity: 'WARNING'
    });
  }

  // Rule 5: Currency Inconsistency (assume base INR)
  if (currency && currency.trim().toUpperCase() !== 'INR') {
    issues.push({
      issueType: 'CURRENCY_INCONSISTENCY',
      fieldName: 'currency',
      message: `Expense currency is ${currency}, which differs from group base (INR).`,
      severity: 'WARNING'
    });
  }

  // Resolve Payer User
  let payerUser = null;
  if (paid_by) {
    payerUser = await resolveUser(paid_by);

    // Rule 6: Unknown Payer User
    if (!payerUser) {
      issues.push({
        issueType: 'UNKNOWN_USER',
        fieldName: 'paid_by',
        message: `Payer user "${paid_by}" is not registered in the database.`,
        severity: 'ERROR'
      });
    } else {
      // Rule 7: Payer not in Group on expense date
      if (parsedDate) {
        const isPayerActive = await checkMemberOnDate(groupId, payerUser.id, parsedDate);
        if (!isPayerActive) {
          issues.push({
            issueType: 'EXPENSE_OUTSIDE_MEMBERSHIP',
            fieldName: 'paid_by',
            message: `Payer "${payerUser.name}" was not active in this group on ${date}.`,
            severity: 'WARNING'
          });
        }
      }
    }
  }

  // Parse Participants & Splits
  const parsedParts = parseParticipants(split_with, split_details, split_type);

  if (parsedParts.length === 0 && !isSettlementSplit) {
    issues.push({
      issueType: 'EMPTY_FIELD',
      fieldName: 'split_with',
      message: 'Split participants list is empty.',
      severity: 'ERROR'
    });
  } else {
    let splitValueSum = 0;

    for (const part of parsedParts) {
      if (part.value !== null) {
        splitValueSum += part.value;
      }

      const partUser = await resolveUser(part.name);

      if (!partUser) {
        issues.push({
          issueType: 'UNKNOWN_USER',
          fieldName: 'split_with',
          message: `Participant "${part.name}" is not registered.`,
          severity: 'ERROR'
        });
      } else {
        if (parsedDate) {
          const isPartActive = await checkMemberOnDate(groupId, partUser.id, parsedDate);
          if (!isPartActive) {
            issues.push({
              issueType: 'EXPENSE_OUTSIDE_MEMBERSHIP',
              fieldName: 'split_with',
              message: `Participant "${partUser.name}" was not active in this group on ${date}.`,
              severity: 'WARNING'
            });
          }
        }
      }
    }

    // Rule 8: Splits values not matching totals
    const type = split_type ? split_type.trim().toUpperCase() : 'EQUAL';
    
    if ((type === 'EXACT' || type === 'UNEQUAL') && amount && !isNaN(numAmount)) {
      const diff = Math.abs(numAmount - splitValueSum);
      if (diff > 0.01) {
        issues.push({
          issueType: 'SPLIT_MISMATCH',
          fieldName: 'split_details',
          message: `Sum of exact splits (${splitValueSum}) does not equal the total amount (${numAmount}).`,
          severity: 'ERROR'
        });
      }
    } else if (type === 'PERCENTAGE') {
      if (Math.round(splitValueSum * 100) / 100 !== 100) {
        issues.push({
          issueType: 'SPLIT_MISMATCH',
          fieldName: 'split_details',
          message: `Sum of split percentages (${splitValueSum}%) does not equal exactly 100%.`,
          severity: 'ERROR'
        });
      }
    }
  }

  // Rule 9: Duplicate Expense check
  if (description && amount && !isNaN(numAmount) && payerUser && parsedDate) {
    const existing = await prisma.expense.findFirst({
      where: {
        groupId,
        amount: numAmount,
        paidBy: payerUser.id,
        date: parsedDate,
        title: { equals: description.trim(), mode: 'insensitive' }
      }
    });

    if (existing) {
      issues.push({
        issueType: 'DUPLICATE_EXPENSE',
        fieldName: 'description',
        message: 'A duplicate expense with the same description, amount, payer, and date already exists.',
        severity: 'WARNING'
      });
    }
  }

  return issues;
};

/**
 * Creates a new Import Session and logs anomalies.
 */
exports.processCSVUpload = async (fileBuffer, fileName, userId, groupId) => {
  const csvContent = fileBuffer.toString('utf-8');
  const rows = parseCSV(csvContent);

  // 1. Create ImportSession
  const session = await prisma.importSession.create({
    data: {
      fileName,
      status: 'PENDING',
      userId,
      processedCount: rows.length
    }
  });

  let anomalyCount = 0;
  const issuesData = [];

  // 2. Scan every row for anomalies
  for (const row of rows) {
    const anomalies = await detectAnomalies(row, groupId);
    if (anomalies.length > 0) {
      anomalyCount += anomalies.length;
      anomalies.forEach(anomaly => {
        issuesData.push({
          importSessionId: session.id,
          rowIndex: row.rowIndex,
          rowData: JSON.stringify(row.data),
          fieldName: anomaly.fieldName,
          issueType: anomaly.issueType,
          message: anomaly.message,
          severity: anomaly.severity
        });
      });
    } else {
      issuesData.push({
        importSessionId: session.id,
        rowIndex: row.rowIndex,
        rowData: JSON.stringify(row.data),
        fieldName: null,
        issueType: 'CLEAN',
        message: 'Clean row',
        severity: 'INFO'
      });
    }
  }

  // Save detected issues
  if (issuesData.length > 0) {
    await prisma.importIssue.createMany({
      data: issuesData
    });
  }

  // Update session status/counts
  const updatedSession = await prisma.importSession.update({
    where: { id: session.id },
    data: {
      anomalyCount,
      status: anomalyCount > 0 ? 'RESOLVING' : 'PENDING'
    }
  });

  return updatedSession;
};

/**
 * Finalizes import session after resolutions are approved.
 * Writes verified records to database.
 */
exports.finalizeCSVImport = async (sessionId, resolutions, groupId, creatorId) => {
  const session = await prisma.importSession.findUnique({
    where: { id: sessionId },
    include: { issues: true }
  });

  if (!session) throw new Error('Import session not found.');
  if (session.status === 'FINALIZED') throw new Error('Import session already finalized.');

  const resMap = resolutions || {};
  const allIssues = session.issues;
  
  // Group issues by rowIndex
  const issuesByRow = {};
  allIssues.forEach(issue => {
    if (!issuesByRow[issue.rowIndex]) {
      issuesByRow[issue.rowIndex] = [];
    }
    issuesByRow[issue.rowIndex].push(issue);
  });

  const importedExpenses = [];

  // Wrap all insertions in a transaction
  await prisma.$transaction(async (tx) => {
    
    for (let i = 1; i <= session.processedCount; i++) {
      const rowIssues = issuesByRow[i] || [];
      
      let isSkipped = false;
      let userApproved = true;
      let adjustments = {};

      // Check resolutions for issues of this row
      for (const issue of rowIssues) {
        if (issue.issueType === 'CLEAN') continue;

        const resolution = resMap[issue.id];
        if (resolution) {
          if (resolution.action === 'SKIP') {
            isSkipped = true;
          } else if (resolution.action === 'IMPORT') {
            userApproved = true;
            await tx.importIssue.update({
              where: { id: issue.id },
              data: { userApproved: true, policyAction: 'IMPORT', resolvedAt: new Date() }
            });
          } else if (resolution.action === 'ADJUST') {
            userApproved = true;
            adjustments = { ...adjustments, ...resolution.adjustment };
            await tx.importIssue.update({
              where: { id: issue.id },
              data: { userApproved: true, policyAction: 'ADJUST', resolvedAt: new Date() }
            });
          }
        } else if (issue.severity === 'ERROR') {
          isSkipped = true;
        } else {
          isSkipped = true;
        }
      }

      if (isSkipped) continue;

      const baseIssue = rowIssues[0];
      if (!baseIssue) continue;

      const rawData = JSON.parse(baseIssue.rowData);

      // Apply adjustments if any
      const description = adjustments.description || rawData.description;
      const amount = adjustments.amount !== undefined ? Number(adjustments.amount) : Number(rawData.amount);
      const currency = adjustments.currency || rawData.currency || 'INR';
      const dateStr = adjustments.date || rawData.date;
      const paidBy = adjustments.paid_by || rawData.paid_by;
      const splitType = adjustments.split_type || rawData.split_type || 'equal';
      const splitWith = adjustments.split_with || rawData.split_with;
      const splitDetails = adjustments.split_details || rawData.split_details;
      const exchangeRate = adjustments.exchangeRate !== undefined ? Number(adjustments.exchangeRate) : 1.0;

      const parsedDate = parseCSVDate(dateStr) || new Date();

      // 1. Resolve Payer User
      const payerUser = await resolveUser(paidBy);
      if (!payerUser) continue;

      // 2. Parse participants and values
      const parsedParts = parseParticipants(splitWith, splitDetails, splitType);
      const splitsArray = [];

      for (const part of parsedParts) {
        const partUser = await resolveUser(part.name);
        if (partUser) {
          splitsArray.push({
            userId: partUser.id,
            value: part.value
          });
        }
      }

      // Check if this is a settlement row that user decided to convert
      const descriptionLower = description.toLowerCase();
      const settlementKeywords = ['settle', 'payment', 'paid back', 'refund', 'repay', 'settlement'];
      const isSettlementAdjustment = adjustments.importAsSettlement === true || 
        (settlementKeywords.some(keyword => descriptionLower.includes(keyword)) && adjustments.importAsSettlement !== false);

      if (isSettlementAdjustment && splitsArray.length > 0) {
        // Record as Settlement instead of Expense
        const receiver = splitsArray[0];
        await tx.settlement.create({
          data: {
            payerId: payerUser.id,
            receiverId: receiver.userId,
            amount: amount,
            currency,
            exchangeRate,
            date: parsedDate,
            groupId
          }
        });
      } else {
        // 3. Compute Shares
        const normalizedSplitType = splitType.trim().toUpperCase();
        const sharesInput = normalizedSplitType === 'EQUAL' ? splitsArray.map(s => s.userId) : splitsArray;
        const calculatedShares = splitService.calculateSplits(normalizedSplitType, amount, sharesInput);

        // 4. Create Expense
        const expense = await tx.expense.create({
          data: {
            title: description.trim(),
            amount,
            currency,
            exchangeRate,
            date: parsedDate,
            paidBy: payerUser.id,
            groupId,
            createdBy: creatorId
          }
        });

        // Create participant records
        const participantData = calculatedShares.map(share => ({
          expenseId: expense.id,
          userId: share.userId,
          amountOwed: share.amountOwed,
          splitType: normalizedSplitType,
          splitValue: share.splitValue
        }));

        await tx.expenseParticipant.createMany({
          data: participantData
        });

        importedExpenses.push(expense);
      }
    }

    // Mark session as finalized
    await tx.importSession.update({
      where: { id: sessionId },
      data: { status: 'FINALIZED' }
    });
  });

  return { success: true, count: importedExpenses.length };
};
