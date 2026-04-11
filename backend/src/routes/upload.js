import { Router } from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { calculateRatios } from '../services/calculator.js';
const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Sadece .xlsx veya .xls dosyalari kabul edilir'));
  }
});

router.post('/fundamental/:ticker', upload.single('file'), asyncHandler(async (req, res) => {
  const { ticker } = req.params;
  if (!req.file) return res.status(400).json({ error: 'Dosya yok' });
  const workbook = xlsx.read(req.file.buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);
  if (!rows.length) return res.status(400).json({ error: 'Excel bos' });
  const row = rows[0];
  const fundamental = {
    currentAssets: parseFloat(row['Donen_Varliklar'] || 0),
    currentLiabilities: parseFloat(row['Kisa_Borc'] || 0),
    inventory: parseFloat(row['Stok'] || 0),
    totalAssets: parseFloat(row['Toplam_Varlik'] || 0),
    equity: parseFloat(row['Ozkaynak'] || 0),
    netSales: parseFloat(row['Net_Satis'] || 0),
    grossProfit: parseFloat(row['Brut_Kar'] || 0),
    ebitda: parseFloat(row['FAVOK'] || 0),
    netProfit: parseFloat(row['Net_Kar'] || 0),
    netFinancialDebt: parseFloat(row['Net_Finansal_Borc'] || 0),
    sharesOutstanding: parseFloat(row['Hisse_Sayisi'] || 0),
    period: row['Donem'] || new Date().toISOString().slice(0,7)
  };
  const lastPrice = await prisma.pricePoint.findFirst({ where: { stockTicker: ticker }, orderBy: { date: 'desc' } }).then(p => p?.close || null);
  const ratios = calculateRatios(fundamental, lastPrice, fundamental.sharesOutstanding);

  await prisma.$transaction(async (tx) => {
    await tx.stock.upsert({ where: { ticker }, update: {}, create: { ticker, name: ticker } });
    await tx.fundamentalData.create({ data: { ...fundamental, stockTicker: ticker } });
    await tx.stockRatio.upsert({ where: { stockTicker: ticker }, update: { ...ratios, calculatedAt: new Date() }, create: { ...ratios, stockTicker: ticker } });
  });

  res.json({ success: true, ratios });
}));

export default router;
