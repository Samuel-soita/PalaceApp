import { PrismaClient } from '@prisma/client';

const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

/**
 * 🗑️ GLOBAL SOFT-DELETE EXTENSION - v2.4.0
 * Standardizes data decommission across the entire church ecosystem.
 */
const SOFT_DELETABLE_MODELS = [
    'User', 'Child', 'Department', 'Event', 'Meeting', 
    'Announcement', 'Project', 'Plan', 'Account', 
    'Transaction', 'Baptism', 'Partnership', 'PartnershipLedger', 'Budget', 'Devotion'
];

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
          if (model && SOFT_DELETABLE_MODELS.includes(model)) {
              if (!args) args = {};
              args.where = { ...args.where, deletedAt: null };
          }
          return query(args);
      },
      async findFirst({ model, args, query }) {
          if (model && SOFT_DELETABLE_MODELS.includes(model)) {
              if (!args) args = {};
              args.where = { ...args.where, deletedAt: null };
          }
          return query(args);
      },
      async delete({ model, args, query }) {
          if (model && SOFT_DELETABLE_MODELS.includes(model)) {
              const modelProp = model.charAt(0).toLowerCase() + model.slice(1);
              return (basePrisma as any)[modelProp].update({
                  ...args,
                  data: { deletedAt: new Date() },
              });
          }
          return query(args);
      },
      async deleteMany({ model, args, query }) {
          if (model && SOFT_DELETABLE_MODELS.includes(model)) {
              const modelProp = model.charAt(0).toLowerCase() + model.slice(1);
              if (!args) args = {};
              if (args.where) {
                  (args.where as any).deletedAt = null;
              } else {
                  args.where = { deletedAt: null } as any;
              }
              return (basePrisma as any)[modelProp].updateMany({
                  ...args,
                  data: { deletedAt: new Date() },
              });
          }
          return query(args);
      },
    },
  },
});

export default prisma;
