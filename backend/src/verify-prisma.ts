import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
console.log('Event:', !!prisma.event);
console.log('Project:', !!prisma.project);
console.log('Plan:', !!prisma.plan);
console.log('TechnicalRepair:', !!prisma.technicalRepair);
console.log('DepartmentReport:', !!prisma.departmentReport);
console.log('WatuaActionLog:', !!prisma.watuaActionLog);
prisma.$disconnect();
