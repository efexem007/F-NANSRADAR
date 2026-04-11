import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { runBacktest } from '../services/backtest.js';
import { authenticate } from '../middleware/auth.js';
const router = Router();
router.use(authenticate);

router.get('/:ticker', asyncHandler(async (req, res) => {
  const { ticker } = req.params;
  const { startDate, endDate } = req.query;
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 90*24*3600000);
  const end = endDate ? new Date(endDate) : new Date();
  const result = await runBacktest(ticker, start, end);
  res.json(result);
}));

export default router;
