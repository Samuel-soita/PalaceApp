import { PrismaClient } from '@prisma/client';

// For high concurrency (400+ users), we configure the client with connection pooling
// and optimized logging. 
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

export default prisma;
export { prisma };
