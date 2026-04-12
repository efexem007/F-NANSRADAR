const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');

// Prisma Client singleton
let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'info' },
      { emit: 'event', level: 'warn' },
    ],
  });
} else {
  prisma = new PrismaClient({
    log: ['query', 'error', 'warn'],
  });
}

// Query logging (development)
if (process.env.NODE_ENV !== 'production') {
  prisma.$on('query', (e) => {
    logger.debug('Prisma Query', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    });
  });
}

prisma.$on('error', (e) => {
  logger.error('Prisma Error:', e.message);
});

// N+1 Query önleme - include helper
prisma.$use(async (params, next) => {
  const before = Date.now();
  const result = await next(params);
  const after = Date.now();
  
  // Yavaş query uyarısı
  if (after - before > 500) {
    logger.warn('Yavaş query tespit edildi', {
      model: params.model,
      action: params.action,
      duration: `${after - before}ms`,
    });
  }
  
  return result;
});

// Pagination helper
const paginate = async (model, options = {}) => {
  const {
    page = 1,
    limit = 20,
    where = {},
    orderBy = {},
    include = {},
    select = null,
  } = options;

  const skip = (page - 1) * limit;
  const take = limit;

  const [data, total] = await Promise.all([
    prisma[model].findMany({
      where,
      ...(select ? { select } : { include }),
      orderBy,
      skip,
      take,
    }),
    prisma[model].count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
};

// Batch operations
const batchOperations = {
  // Toplu create
  createMany: async (model, data, options = {}) => {
    const { skipDuplicates = true, chunkSize = 1000 } = options;
    const results = [];
    
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const result = await prisma[model].createMany({
        data: chunk,
        skipDuplicates,
      });
      results.push(result);
    }
    
    return {
      count: results.reduce((sum, r) => sum + r.count, 0),
      chunks: results.length,
    };
  },

  // Toplu update
  updateMany: async (model, where, data, options = {}) => {
    const { chunkSize = 1000 } = options;
    
    // Önce ID'leri al
    const items = await prisma[model].findMany({
      where,
      select: { id: true },
    });
    
    let updated = 0;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const result = await prisma[model].updateMany({
        where: { id: { in: chunk.map(item => item.id) } },
        data,
      });
      updated += result.count;
    }
    
    return { count: updated };
  },

  // Toplu delete
  deleteMany: async (model, where, options = {}) => {
    const { chunkSize = 1000 } = options;
    
    const items = await prisma[model].findMany({
      where,
      select: { id: true },
    });
    
    let deleted = 0;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const result = await prisma[model].deleteMany({
        where: { id: { in: chunk.map(item => item.id) } },
      });
      deleted += result.count;
    }
    
    return { count: deleted };
  },
};

// Transaction helper
const withTransaction = async (operations, options = {}) => {
  const { isolationLevel = 'Serializable', maxWait = 5000, timeout = 10000 } = options;
  
  return prisma.$transaction(async (tx) => {
    return await operations(tx);
  }, {
    isolationLevel,
    maxWait,
    timeout,
  });
};

// Raw query with safety
const safeRawQuery = async (query, values = []) => {
  // SQL injection kontrolü
  const dangerousPatterns = [/;\s*drop/i, /;\s*delete/i, /;\s*update/i, /--/];
  if (dangerousPatterns.some(pattern => pattern.test(query))) {
    throw new Error('Potansiyel SQL injection tespit edildi');
  }
  
  return prisma.$queryRawUnsafe(query, ...values);
};

// Connection health check
const healthCheck = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', connected: true };
  } catch (error) {
    return { status: 'unhealthy', connected: false, error: error.message };
  }
};

module.exports = {
  prisma,
  paginate,
  batchOperations,
  withTransaction,
  safeRawQuery,
  healthCheck,
};
