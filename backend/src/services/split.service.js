/**
 * Split Service.
 * Implements business logic for dividing expense totals among group members.
 * Accounts for rounding remainders in fixed-point division to prevent cash loss.
 */

/**
 * Splits an amount equally among a list of user IDs.
 * Adds any rounding remainder to the first participant.
 * 
 * @param {number} totalAmount Total expense amount
 * @param {string[]} userIds Array of user IDs
 * @returns {Array<{userId: string, amountOwed: number, splitValue: number}>}
 */
const splitEqually = (totalAmount, userIds) => {
  if (!userIds || userIds.length === 0) {
    throw new Error('Equal split requires at least one participant.');
  }

  const count = userIds.length;
  // Calculate base share rounded down to 2 decimal places
  const baseShare = Math.floor((totalAmount / count) * 100) / 100;
  
  // Calculate rounding remainder
  const sumOfShares = baseShare * count;
  const remainder = Math.round((totalAmount - sumOfShares) * 100) / 100;

  return userIds.map((userId, index) => {
    // Add remainder to the first participant
    const owed = index === 0 ? Math.round((baseShare + remainder) * 100) / 100 : baseShare;
    return {
      userId,
      amountOwed: owed,
      splitValue: null // Equal split doesn't need input value storage
    };
  });
};

/**
 * Splits an amount exactly based on specific amounts provided for each user.
 * Verifies that the sum of shares equals the total amount.
 * 
 * @param {number} totalAmount Total expense amount
 * @param {Array<{userId: string, value: number}>} splits List of user IDs and their exact shares
 * @returns {Array<{userId: string, amountOwed: number, splitValue: number}>}
 */
const splitExactly = (totalAmount, splits) => {
  if (!splits || splits.length === 0) {
    throw new Error('Exact split requires split definitions.');
  }

  let sum = 0;
  const result = splits.map(s => {
    const val = Math.round(Number(s.value) * 100) / 100;
    sum += val;
    return {
      userId: s.userId,
      amountOwed: val,
      splitValue: val
    };
  });

  // Check if total equals sum (allowing 0.02 tolerance for rounding errors in inputs, or require exact match)
  const diff = Math.abs(Math.round((totalAmount - sum) * 100) / 100);
  if (diff > 0.01) {
    throw new Error(`Sum of exact splits (${sum}) does not match the total amount (${totalAmount}).`);
  }

  // Adjust minor 0.01 difference to first participant if needed
  if (diff > 0 && diff <= 0.01 && result.length > 0) {
    const adjustment = Math.round((totalAmount - sum) * 100) / 100;
    result[0].amountOwed = Math.round((result[0].amountOwed + adjustment) * 100) / 100;
  }

  return result;
};

/**
 * Splits an amount by percentage shares.
 * Verifies that percentages sum to 100%.
 * Adds any rounding remainder to the first participant.
 * 
 * @param {number} totalAmount Total expense amount
 * @param {Array<{userId: string, value: number}>} splits List of user IDs and their percentage values
 * @returns {Array<{userId: string, amountOwed: number, splitValue: number}>}
 */
const splitByPercentage = (totalAmount, splits) => {
  if (!splits || splits.length === 0) {
    throw new Error('Percentage split requires split definitions.');
  }

  let percentageSum = 0;
  const result = splits.map(s => {
    const pct = Number(s.value);
    percentageSum += pct;
    
    // Calculate share amount
    const share = Math.floor(((totalAmount * pct) / 100) * 100) / 100;
    
    return {
      userId: s.userId,
      amountOwed: share,
      splitValue: pct
    };
  });

  // Verify percentage sum is exactly 100
  if (Math.round(percentageSum * 100) / 100 !== 100) {
    throw new Error(`Sum of percentages (${percentageSum}%) must equal exactly 100%.`);
  }

  // Correct rounding errors for money amounts
  const sumOfOwed = result.reduce((acc, r) => acc + r.amountOwed, 0);
  const remainder = Math.round((totalAmount - sumOfOwed) * 100) / 100;

  if (remainder > 0 && result.length > 0) {
    result[0].amountOwed = Math.round((result[0].amountOwed + remainder) * 100) / 100;
  }

  return result;
};

/**
 * Splits an amount by share weights.
 * e.g. Aisha = 2 shares, Rohan = 1 share, Priya = 1 share.
 * 
 * @param {number} totalAmount Total expense amount
 * @param {Array<{userId: string, value: number}>} splits List of user IDs and their share weights
 * @returns {Array<{userId: string, amountOwed: number, splitValue: number}>}
 */
const splitByShare = (totalAmount, splits) => {
  if (!splits || splits.length === 0) {
    throw new Error('Share split requires split definitions.');
  }

  const totalShares = splits.reduce((acc, s) => acc + Number(s.value), 0);
  if (totalShares <= 0) {
    throw new Error('Total share weights must be greater than zero.');
  }

  const result = splits.map(s => {
    const weight = Number(s.value);
    const shareAmount = Math.floor(((totalAmount * weight) / totalShares) * 100) / 100;
    return {
      userId: s.userId,
      amountOwed: shareAmount,
      splitValue: weight
    };
  });

  // Rounding error correction
  const sumOfOwed = result.reduce((acc, r) => acc + r.amountOwed, 0);
  const remainder = Math.round((totalAmount - sumOfOwed) * 100) / 100;

  if (remainder > 0 && result.length > 0) {
    result[0].amountOwed = Math.round((result[0].amountOwed + remainder) * 100) / 100;
  }

  return result;
};

/**
 * General split handler that dispatches to specific strategies.
 * Design enables adding new split strategies (e.g. BY_WEIGHT) easily.
 */
exports.calculateSplits = (splitType, totalAmount, inputData) => {
  const amount = Number(totalAmount);
  if (isNaN(amount) || amount < 0) { // Allow 0 amount as it can exist as an anomaly
    throw new Error('Expense amount must be a non-negative number.');
  }

  const upperSplitType = splitType ? splitType.toUpperCase() : 'EQUAL';

  switch (upperSplitType) {
    case 'EQUAL':
      return splitEqually(amount, inputData);
    case 'EXACT':
    case 'UNEQUAL':
      // inputData is Array<{userId: string, value: number}>
      return splitExactly(amount, inputData);
    case 'PERCENTAGE':
      // inputData is Array<{userId: string, value: number}>
      return splitByPercentage(amount, inputData);
    case 'SHARE':
      // inputData is Array<{userId: string, value: number}>
      return splitByShare(amount, inputData);
    default:
      throw new Error(`Unsupported split type: ${splitType}`);
  }
};

