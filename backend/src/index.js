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
  max: 100 // limit each IP to 100 requests per windowMs
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Cron job for updating stock data
cron.schedule('0 9 * * 1-5', async () => {
  // Update stock prices on weekdays at 9 AM
  console.log('Updating stock data...');
  // TODO: Implement stock update logic
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;