/**
 * FinansRadar — Optimized Prisma Client
 * Singleton + query logging + batch op helpers
 */

import { PrismaClient } from '@prisma/client';

const isDev = process.env.NODE_ENV !== 'production';

// ─── Singleton Prisma Client ───────────────────────────────────────────────
const prisma = globalThis.__prisma ?? new PrismaClient({
  log: isDev
    ? [{ emit: 'event', level: 'query' }, { emit: 'stdout', level: 'error' }, { emit: 'stdout', level: 'warn' }]
    : [{ emit: 'stdout', level: 'error' }],
});

// Slow query uyarısı (> 500ms)
if (isDev && prisma.$on) {
  prisma.$on('query', (e) => {
    if (e.duration > 500) {
      console.warn(`⚠️  Yavaş Sorgu (${e.duration}ms): ${e.query}`);
    }
  });
}

if (!globalThis.__prisma) {
  globalThis.__prisma = prisma;
}

// ─── Paginate Helper ──────────────────────────────────────────────────────
export async function paginate(model, { where = {}, orderBy, select, page = 1, pageSize = 20 } = {}) {
  const skip = (page - 1) * pageSize;
  const [total, items] = await Promise.all([
    model.count({ where }),
    model.findMany({ where, orderBy, select, skip, take: pageSize }),
  ]);
  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrev: page > 1,
    },
  };
}

// ─── Safe disconnect ──────────────────────────────────────────────────────
export async function disconnectPrisma() {
  await prisma.$disconnect();
}

export default prisma;
