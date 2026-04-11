import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { fetchStockPrices } from '../services/yahooFinance.js';
const router = Router();

router.get('/list', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const [stocks, total] = await prisma.$transaction([
    prisma.stock.findMany({ include: { ratios: true }, take: limit, skip: offset, orderBy: { ticker: 'asc' } }),
    prisma.stock.count()
  ]);
  res.json({ data: stocks, total, limit, offset });
}));

router.get('/:ticker/price', asyncHandler(async (req, res) => {
  const { ticker } = req.params;
  const { period = '3mo' } = req.query;
  const data = await fetchStockPrices(ticker, period);
  res.json(data);
}));

router.get('/:ticker/fundamental', asyncHandler(async (req, res) => {
  const { ticker } = req.params;
  const stock = await prisma.stock.findUnique({ where: { ticker }, include: { fundamental: { orderBy: { period: 'desc' }, take: 1 }, ratios: true } });
  res.json(stock);
}));

export default router;
