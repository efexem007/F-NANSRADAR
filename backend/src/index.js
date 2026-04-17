import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import cron from 'node-cron';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';


import authRoutes      from './routes/auth.js';
import portfolioRoutes from './routes/portfolio.js';
import stockRoutes     from './routes/stock.js';
import signalRoutes    from './routes/signal.js';
import syncRoutes      from './routes/sync.js';
import uploadRoutes    from './routes/upload.js';
import macroRoutes     from './routes/macro.js';
import reportRoutes    from './routes/report.js';
import backtestRoutes  from './routes/backtest.js';
import scanRoutes      from './routes/scan.js';
import universalRoutes from './routes/universal.js';

import aiRoutes        from './routes/ai.js';
import predictionRoutes from './routes/prediction.js';
import analysisRoutes   from './routes/analysis.js';
import adminCacheRoutes from './routes/admin/cache.js';
import batchRoutes      from './routes/batch.js';

import { defaultLimiter, authLimiter, stockLimiter, scanLimiter, macroLimiter, reportLimiter, universalLimiter } from './middleware/smartRateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { httpLogger } from './lib/logger.js';
import logger from './lib/logger.js';
import cache from './lib/cache.js';
import { scanAllStocks } from './services/scanner.js';

dotenv.config();

// ─── Express App ──────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Security Middleware ──────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // API sunucusu — CSP gerekmez
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(httpLogger);

// ─── Global rate limit (varsayılan) ──────────────────────────────────────
app.use(defaultLimiter);

// ─── Routes (endpoint bazlı rate limit) ──────────────────────────────────
app.use('/api/auth',      authLimiter,      authRoutes);
app.use('/api/portfolio',                   portfolioRoutes);
app.use('/api/stock',     stockLimiter,     stockRoutes);
app.use('/api/signal',                      signalRoutes);
app.use('/api/sync',                        syncRoutes);
app.use('/api/upload',                      uploadRoutes);
app.use('/api/macro',     macroLimiter,     macroRoutes);
app.use('/api/report',    reportLimiter,    reportRoutes);
app.use('/api/backtest',                    backtestRoutes);
app.use('/api/scan',      scanLimiter,      scanRoutes);
app.use('/api/universal', universalLimiter, universalRoutes);

app.use('/api/ai',                          aiRoutes);
app.use('/api/prediction',                  predictionRoutes);
app.use('/api/analysis',                    analysisRoutes);
app.use('/api/admin/cache',                 adminCacheRoutes);
app.use('/api/batch',                        batchRoutes);

// ─── API Documentation (Swagger) ──────────────────────────────────────────
try {
  const swaggerDocument = YAML.load('./swagger.yaml');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (e) {
  console.log('Swagger dosyası yüklenemedi, API-docs devre dışı.');
}

// ─── Health Check ────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    cache: cache.stats(),
  });
});

// ─── Cache Stats Endpoint ─────────────────────────────────────────────────
app.get('/api/cache/stats', (req, res) => {
  res.json(cache.stats());
});

// ─── 404 & Error Handlers ─────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── HTTP + Socket.IO Sunucu ──────────────────────────────────────────────
const httpServer = createServer(app);

let io;
try {
  io = new SocketIO(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    logger.info(`WebSocket bağlandı: ${socket.id}`);

    socket.on('subscribe:market', (market) => {
      socket.join(`market:${market}`);
    });

    socket.on('disconnect', () => {
      logger.info(`WebSocket ayrıldı: ${socket.id}`);
    });
  });

  // Global'e dışarıdan erişim için
  global.io = io;
} catch (err) {
  logger.warn('Socket.IO başlatılamadı:', { error: err.message });
}

// ─── Cron Jobs ────────────────────────────────────────────────────────────
// Otomatik tarama: 09:00, 13:00, 18:00
cron.schedule('0 9,13,18 * * 1-5', async () => {
  logger.info('Otomatik tarama başlıyor...');
  try {
    const results = await scanAllStocks();
    await cache.deleteCachePattern('scan:*');
    logger.info(`Otomatik tarama tamamlandı: ${results.length} hisse`);
    // WebSocket ile frontend'e bildir
    if (global.io) {
      global.io.emit('scan:complete', { count: results.length, time: new Date().toISOString() });
    }
  } catch (err) {
    logger.error('Otomatik tarama hatası:', { error: err.message });
  }
});

// Cache temizlik (her gece 02:00)
cron.schedule('0 2 * * *', async () => {
  await cache.deleteCachePattern('*');
  logger.info('Gece cache temizlendi');
});

// ─── Startup ──────────────────────────────────────────────────────────────
async function start() {
  // Cache bağlan (Redis varsa)
  await cache.connect();

  httpServer.listen(PORT, () => {
    logger.info(`🚀 FinansRadar Backend — port ${PORT}`);
    logger.info(`📦 Cache engine: ${cache.stats().engine}`);
    logger.info(`🌍 CORS origin: ${process.env.ALLOWED_ORIGIN || 'localhost:5173'}`);
  });
}

start().catch(err => {
  logger.error('Sunucu başlatılamadı:', { error: err.message });
  process.exit(1);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────
process.on('SIGTERM', async () => {
  logger.info('SIGTERM alındı, kapatılıyor...');
  httpServer.close(async () => {
    const { disconnectPrisma } = await import('./lib/prisma.js');
    await disconnectPrisma();
    logger.info('Sunucu kapatıldı');
    process.exit(0);
  });
});

export default app;
export { io };