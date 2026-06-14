const { PrismaClient } = require('@prisma/client');

// Initialize the PrismaClient instance
// In clean architecture, this serves as our database adapter/data access layer
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error']
});

module.exports = prisma;
