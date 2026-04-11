import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { generatePortfolioReport, deleteTempFile } from '../services/pdfReport.js';
import { authenticate } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
const router = Router();
router.use(authenticate);

router.get('/portfolio', asyncHandler(async (req, res) => {
  const portfolio = await prisma.portfolio.findFirst({ where: { userId: req.user.id }, include: { items: true } });
  if (!portfolio) return res.status(404).json({ error: 'Portfoy yok' });
  const pdfPath = await generatePortfolioReport({ user: req.user, portfolio, date: new Date() });
  res.download(pdfPath, `rapor_${Date.now()}.pdf`, () => { setTimeout(() => deleteTempFile(pdfPath), 5000); });
}));

export default router;
