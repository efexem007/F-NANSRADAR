import { Router } from 'express';
import QRCode from 'qrcode';
import { asyncHandler } from '../lib/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
const router = Router();
router.use(authenticate);

router.get('/export', asyncHandler(async (req, res) => {
  const portfolio = await prisma.portfolio.findFirst({ where: { userId: req.user.id }, include: { items: true } });
  const data = { portfolio, settings: {}, version: 1 };
  const qr = await QRCode.toDataURL(JSON.stringify(data));
  res.json({ qrCode: qr });
}));

router.post('/import', asyncHandler(async (req, res) => {
  const { data } = req.body;
  const parsed = JSON.parse(data);
  if (parsed.portfolio) {
    await prisma.portfolioItem.deleteMany({ where: { portfolio: { userId: req.user.id } } });
    const portfolio = await prisma.portfolio.findFirst({ where: { userId: req.user.id } });
    if (portfolio && parsed.portfolio.items) {
      for (const item of parsed.portfolio.items) {
        await prisma.portfolioItem.create({ data: { portfolioId: portfolio.id, ticker: item.ticker, shares: item.shares, avgCost: item.avgCost } });
      }
    }
  }
  res.json({ success: true });
}));

export default router;
