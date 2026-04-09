import { PrismaClient } from '@prisma/client';

// --- CONNECTION SHIELD: Protect against malformed Render Environment Variables ---
let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl) {
    // Automatically strip accidental quotes or trailing spaces (Common Copy-Paste issues)
    const cleanedUrl = dbUrl.trim().replace(/^["']|["']$/g, '');
    if (cleanedUrl !== dbUrl) {
        console.warn('[Prisma Shield] Formatting error detected in DATABASE_URL. Auto-corrected.');
        process.env.DATABASE_URL = cleanedUrl;
    }
} else {
    console.error('[Prisma Shield] CRITICAL: DATABASE_URL is missing from environment.');
}

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

/**
 * 🕵️ PRESENCE-AWARE SHIELD
 * Recursively checks if 'deletedAt' is already explicitly targeted in the query.
 * This allows the Sync Engine to find decommissioned records without
 * being overridden by the global safety filter.
 */
const hasDeletedAt = (where: any): boolean => {
    if (!where || typeof where !== 'object') return false;
    if ('deletedAt' in where) return true;
    if (where.AND && Array.isArray(where.AND) && where.AND.some(hasDeletedAt)) return true;
    if (where.OR && Array.isArray(where.OR) && where.OR.some(hasDeletedAt)) return true;
    if (where.NOT && (Array.isArray(where.NOT) ? where.NOT.some(hasDeletedAt) : hasDeletedAt(where.NOT))) return true;
    return false;
};

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
          if (model && SOFT_DELETABLE_MODELS.includes(model)) {
              if (!args) args = {};
              if (!hasDeletedAt(args.where)) {
                  args.where = { ...args.where, deletedAt: null };
              }
          }
          return query(args);
      },
      async findFirst({ model, args, query }) {
          if (model && SOFT_DELETABLE_MODELS.includes(model)) {
              if (!args) args = {};
              if (!hasDeletedAt(args.where)) {
                  args.where = { ...args.where, deletedAt: null };
              }
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
