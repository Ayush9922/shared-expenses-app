const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with flatmates...');

  // 1. Clear existing records to ensure idempotency
  await prisma.importIssue.deleteMany({});
  await prisma.importSession.deleteMany({});
  await prisma.settlement.deleteMany({});
  await prisma.expenseParticipant.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.groupMember.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. Hash default password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  // 3. Create users
  const flatmates = [
    { name: 'Aisha', email: 'aisha@example.com' },
    { name: 'Rohan', email: 'rohan@example.com' },
    { name: 'Priya', email: 'priya@example.com' },
    { name: 'Meera', email: 'meera@example.com' },
    { name: 'Dev', email: 'dev@example.com' },
    { name: 'Sam', email: 'sam@example.com' }
  ];

  const seededUsers = [];
  for (const f of flatmates) {
    const user = await prisma.user.create({
      data: {
        name: f.name,
        email: f.email,
        passwordHash
      }
    });
    seededUsers.push(user);
    console.log(`- Created user: ${user.name} (${user.email})`);
  }

  // 4. Create a sample group "Flat 302 Flatmates"
  const aisha = seededUsers[0];
  const group = await prisma.group.create({
    data: {
      name: 'Flat 302 Expenses',
      createdBy: aisha.id
    }
  });
  console.log(`- Created group: ${group.name}`);

  // 5. Add all users as active members of this group
  for (const user of seededUsers) {
    await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId: user.id,
        joinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Joined 30 days ago
      }
    });
    console.log(`  * Added member: ${user.name}`);
  }

  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
