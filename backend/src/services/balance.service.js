const prisma = require('../utils/db');

/**
 * Balance Calculation Service.
 * Aggregates all expenses and settlements for a group to calculate net positions,
 * and executes a greedy min-cash-flow optimization to generate a simplified settlement plan.
 */

exports.calculateGroupBalances = async (groupId) => {
  // 1. Fetch group details and all members
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: {
      user: {
        select: { id: true, name: true, email: true }
      }
    }
  });

  // Unique list of users who are or were members
  const userMap = new Map();
  members.forEach(m => {
    userMap.set(m.user.id, {
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      expensesPaid: 0,
      expensesOwed: 0,
      settlementsPaid: 0,
      settlementsReceived: 0,
      netBalance: 0
    });
  });

  // 2. Fetch all expenses in group, including splits
  const expenses = await prisma.expense.findMany({
    where: { groupId },
    include: {
      participants: true
    }
  });

  expenses.forEach(exp => {
    const rate = Number(exp.exchangeRate) || 1.0;
    const paidBy = exp.paidBy;
    const amountBase = Number(exp.amount) * rate;

    // Track money paid by payer (if they are a group member)
    if (userMap.has(paidBy)) {
      const u = userMap.get(paidBy);
      u.expensesPaid += amountBase;
    }

    // Track money owed by participants
    exp.participants.forEach(part => {
      if (userMap.has(part.userId)) {
        const u = userMap.get(part.userId);
        const owedBase = Number(part.amountOwed) * rate;
        u.expensesOwed += owedBase;
      }
    });
  });

  // 3. Fetch all settlements in group
  const settlements = await prisma.settlement.findMany({
    where: { groupId }
  });

  settlements.forEach(set => {
    const rate = Number(set.exchangeRate) || 1.0;
    const payerId = set.payerId;
    const receiverId = set.receiverId;
    const amountBase = Number(set.amount) * rate;

    // Track money paid by settlement payer
    if (userMap.has(payerId)) {
      const u = userMap.get(payerId);
      u.settlementsPaid += amountBase;
    }

    // Track money received by settlement receiver
    if (userMap.has(receiverId)) {
      const u = userMap.get(receiverId);
      u.settlementsReceived += amountBase;
    }
  });

  // 4. Calculate Net Balances for each user
  const userBalances = [];
  userMap.forEach(u => {
    // Formula: netBalance = (Paid - Owed) + (SettlementsPaid - SettlementsReceived)
    u.netBalance = (u.expensesPaid - u.expensesOwed) + (u.settlementsPaid - u.settlementsReceived);
    
    // Round values to 2 decimal places
    u.expensesPaid = Math.round(u.expensesPaid * 100) / 100;
    u.expensesOwed = Math.round(u.expensesOwed * 100) / 100;
    u.settlementsPaid = Math.round(u.settlementsPaid * 100) / 100;
    u.settlementsReceived = Math.round(u.settlementsReceived * 100) / 100;
    u.netBalance = Math.round(u.netBalance * 100) / 100;

    userBalances.push(u);
  });

  // 5. Generate simplified settlement plan using creditor-debtor optimization (Greedy Cash Flow Minimization)
  const settlementPlan = [];
  
  // Separate into debtors (net balance < 0) and creditors (net balance > 0)
  const debtors = userBalances
    .filter(u => u.netBalance < -0.01)
    .map(u => ({
      userId: u.userId,
      name: u.name,
      amountOwed: Math.abs(u.netBalance)
    }));

  const creditors = userBalances
    .filter(u => u.netBalance > 0.01)
    .map(u => ({
      userId: u.userId,
      name: u.name,
      amountOwed: u.netBalance
    }));

  // Match debtors with creditors greedily
  while (debtors.length > 0 && creditors.length > 0) {
    // Sort descending so we match the highest debts/credits first
    debtors.sort((a, b) => b.amountOwed - a.amountOwed);
    creditors.sort((a, b) => b.amountOwed - a.amountOwed);

    const activeDebtor = debtors[0];
    const activeCreditor = creditors[0];

    const paymentAmount = Math.min(activeDebtor.amountOwed, activeCreditor.amountOwed);
    const roundedPayment = Math.round(paymentAmount * 100) / 100;

    if (roundedPayment > 0) {
      settlementPlan.push({
        payerId: activeDebtor.userId,
        payerName: activeDebtor.name,
        receiverId: activeCreditor.userId,
        receiverName: activeCreditor.name,
        amount: roundedPayment,
        currency: 'INR' // Base currency is converted to INR
      });

      // Update positions
      activeDebtor.amountOwed -= roundedPayment;
      activeCreditor.amountOwed -= roundedPayment;
    }

    // Remove if fully settled
    if (activeDebtor.amountOwed < 0.015) {
      debtors.shift();
    }
    if (activeCreditor.amountOwed < 0.015) {
      creditors.shift();
    }
  }

  return {
    balances: userBalances,
    settlementPlan
  };
};
