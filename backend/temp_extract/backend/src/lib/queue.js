const Queue = require('bull');
const logger = require('./logger');

// Redis bağlantı ayarları
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_QUEUE_DB || 1, // Ayrı DB kullan
};

// Queue factory
const createQueue = (name, options = {}) => {
  const queue = new Queue(name, {
    redis: redisConfig,
    defaultJobOptions: {
      attempts: options.attempts || 3,
      backoff: {
        type: options.backoffType || 'exponential',
        delay: options.backoffDelay || 2000,
      },
      removeOnComplete: options.removeOnComplete ?? 100,
      removeOnFail: options.removeOnFail ?? 50,
    },
    limiter: options.limiter || {
      max: 10,
      duration: 1000,
    },
  });

  // Event listeners
  queue.on('completed', (job, result) => {
    logger.info(`Job tamamlandı: ${name}#${job.id}`, {
      jobId: job.id,
      queue: name,
      result,
      duration: Date.now() - job.timestamp,
    });
  });

  queue.on('failed', (job, err) => {
    logger.error(`Job başarısız: ${name}#${job.id}`, {
      jobId: job.id,
      queue: name,
      error: err.message,
      attempts: job.attemptsMade,
    });
  });

  queue.on('stalled', (job) => {
    logger.warn(`Job takıldı: ${name}#${job.id}`, {
      jobId: job.id,
      queue: name,
    });
  });

  queue.on('progress', (job, progress) => {
    logger.debug(`Job ilerleme: ${name}#${job.id} - %${progress}`);
  });

  return queue;
};

// Queue tanımlamaları
const queues = {
  // Hisse senedi tarama queue'su
  stockScanner: createQueue('stock-scanner', {
    attempts: 5,
    backoffType: 'exponential',
    backoffDelay: 5000,
    limiter: { max: 5, duration: 60000 }, // Yahoo Finance limiti
  }),

  // Portföy senkronizasyon queue'su
  portfolioSync: createQueue('portfolio-sync', {
    attempts: 3,
    backoffType: 'fixed',
    backoffDelay: 10000,
  }),

  // Bildirim queue'su
  notifications: createQueue('notifications', {
    attempts: 3,
    removeOnComplete: 50,
  }),

  // Rapor oluşturma queue'su
  reports: createQueue('reports', {
    attempts: 2,
    backoffDelay: 30000,
  }),

  // Veri temizleme queue'su
  cleanup: createQueue('cleanup', {
    attempts: 1,
    removeOnComplete: 10,
  }),
};

// Job durumlarını getir
const getJobStatus = async (queueName, jobId) => {
  const queue = queues[queueName];
  if (!queue) throw new Error(`Queue bulunamadı: ${queueName}`);

  const job = await queue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const progress = job.progress();

  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    result: job.returnvalue,
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
    createdAt: job.timestamp,
    processedAt: job.processedOn,
    finishedAt: job.finishedOn,
  };
};

// Queue istatistikleri
const getQueueStats = async (queueName) => {
  const queue = queues[queueName];
  if (!queue) throw new Error(`Queue bulunamadı: ${queueName}`);

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return {
    name: queueName,
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
};

// Tüm queue istatistikleri
const getAllStats = async () => {
  const stats = await Promise.all(
    Object.keys(queues).map(name => getQueueStats(name))
  );
  return stats;
};

// Job ekleme helper'ı
const addJob = async (queueName, jobName, data, options = {}) => {
  const queue = queues[queueName];
  if (!queue) throw new Error(`Queue bulunamadı: ${queueName}`);

  const job = await queue.add(jobName, data, options);
  logger.info(`Job eklendi: ${queueName}#${job.id}`, {
    queue: queueName,
    jobId: job.id,
    jobName,
  });

  return job;
};

// Job iptal etme
const removeJob = async (queueName, jobId) => {
  const queue = queues[queueName];
  if (!queue) throw new Error(`Queue bulunamadı: ${queueName}`);

  const job = await queue.getJob(jobId);
  if (!job) return false;

  await job.remove();
  logger.info(`Job silindi: ${queueName}#${jobId}`);
  return true;
};

// Queue temizleme
const cleanQueue = async (queueName, options = {}) => {
  const queue = queues[queueName];
  if (!queue) throw new Error(`Queue bulunamadı: ${queueName}`);

  const { status = 'completed', gracePeriod = 86400000 } = options;
  
  await queue.clean(gracePeriod, status);
  logger.info(`Queue temizlendi: ${queueName} (${status})`);
};

// Graceful shutdown
const closeAll = async () => {
  logger.info('Tüm queue\'lar kapatılıyor...');
  await Promise.all(Object.values(queues).map(q => q.close()));
  logger.info('Tüm queue\'lar kapatıldı');
};

module.exports = {
  queues,
  createQueue,
  getJobStatus,
  getQueueStats,
  getAllStats,
  addJob,
  removeJob,
  cleanQueue,
  closeAll,
};
