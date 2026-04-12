import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';

import authRoutes from './routes/auth.js';
import portfolioRoutes from './routes/portfolio.js';
import stockRoutes from './routes/stock.js';
import signalRoutes from './routes/signal.js';
import syncRoutes from './routes/sync.js';
import uploadRoutes from './routes/upload.js';
import macroRoutes from './routes/macro.js';
import reportRoutes from './routes/report.js';
import backtestRoutes from './routes/backtest.js';
import scanRoutes from './routes/scan.js';
import universalRoutes from './routes/universal.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN,
  credentials: true
}));
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500 // limit each IP to 500 requests per windowMs (scanner needs many)
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/signal', signalRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/macro', macroRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/backtest', backtestRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/universal', universalRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Cron job for automatic scanning (09:00, 13:00, 18:00)
import { scanAllStocks } from './services/scanner.js';
cron.schedule('0 9,13,18 * * *', async () => {
  console.log('Otomatik tarama başlıyor (Scanner v4.0)...');
  try {
    const results = await scanAllStocks();
    console.log(`${results.length} hisse başarıyla tarandı.`);
  } catch (error) {
    console.error('Otomatik tarama hatası:', error.message);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;