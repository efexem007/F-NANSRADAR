require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const { errorHandler, notFoundHandler, setupGlobalErrorHandlers } = require('./middleware/errorHandler');
const { smartRateLimit } = require('./middleware/smartRateLimit');
const logger = require('./lib/logger');
const cache = require('./lib/cache');
const { closeAll: closeQueues } = require('./lib/queue');

// Route'lar
const stockRoutes = require('./routes/stock');
const portfolioRoutes = require('./routes/portfolio');
const scanRoutes = require('./routes/scan');
const analysisRoutes = require('./routes/analysis');
const predictionRoutes = require('./routes/prediction');
const aiRoutes = require('./routes/ai');

// Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Global hata yakalayıcıları
setupGlobalErrorHandlers();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Request logging
app.use(logger.httpLogger);

// Health check (rate limit olmadan)
app.get('/health', async (req, res) => {
  const [cacheHealth, dbHealth] = await Promise.all([
    cache.health(),
    require('./lib/prisma').healthCheck(),
  ]);

  const status = cacheHealth.status === 'healthy' && dbHealth.status === 'healthy' 
    ? 200 
    : 503;

  res.status(status).json({
    success: status === 200,
    timestamp: new Date().toISOString(),
    services: {
      api: 'healthy',
      cache: cacheHealth,
      database: dbHealth,
    },
  });
});

// API rate limiting
app.use('/api', smartRateLimit);

// API Routes
app.use('/api/stock', stockRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/prediction', predictionRoutes);
app.use('/api/ai', aiRoutes);

// Cache yönetimi endpoint'leri (admin only)
app.use('/admin/cache', require('./routes/admin/cache'));

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Sunucuyu başlat
const server = app.listen(PORT, () => {
  logger.info(`🚀 Sunucu çalışıyor - Port: ${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} sinyali alındı. Graceful shutdown başlatılıyor...`);

  // Yeni bağlantıları reddet
  server.close(async () => {
    logger.info('HTTP sunucusu kapatıldı');

    try {
      // Queue'ları kapat
      await closeQueues();
      
      // Prisma bağlantısını kapat
      const { prisma } = require('./lib/prisma');
      await prisma.$disconnect();
      
      // Redis bağlantısını kapat
      await cache.client.quit();
      
      logger.info('Tüm bağlantılar kapatıldı. Çıkılıyor...');
      process.exit(0);
    } catch (error) {
      logger.error('Shutdown hatası:', error);
      process.exit(1);
    }
  });

  // Zorla kapatma zaman aşımı
  setTimeout(() => {
    logger.error('Zorla kapatma!');
    process.exit(1);
  }, 30000);
};

// Sinyal dinleyicileri
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
