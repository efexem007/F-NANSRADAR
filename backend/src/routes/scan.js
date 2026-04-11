import { Router } from 'express';
import { scanSingleStock, scanAllStocks } from '../services/scanner.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Manuel tek hisse tarama
router.post('/stock/:ticker', async (req, res) => {
  const result = await scanSingleStock(req.params.ticker);
  res.json(result);
});

// Manuel tüm hisseleri tara
router.post('/all', async (req, res) => {
  const { tickers } = req.body || {};
  scanAllStocks(tickers).then(results => console.log('Toplu tarama tamamlandı:', results.length));
  res.json({ message: 'Tarama arka planda başlatıldı.' });
});

// Sonuçları getir
router.get('/results', async (req, res) => {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const signals = await prisma.signalHistory.findMany({
    orderBy: { createdAt: 'desc' },
    distinct: ['ticker'],
    take: 50
  });
  res.json(signals);
});

export default router;
