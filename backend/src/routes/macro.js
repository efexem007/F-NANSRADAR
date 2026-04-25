import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate, macroSchema } from '../lib/validate.js';
const router = Router();

import { syncMacroData, getMacroData } from '../services/macroData.js';

router.get('/', asyncHandler(async (req, res) => {
  const macros = await getMacroData();
  // Dashboard'un beklediği array formatına dönüştür
  const arr = [
    { type: 'cds', value: macros.cds ?? 265, label: 'CDS Spread' },
    { type: 'vix', value: macros.vix ?? 18.2, label: 'VIX' },
    { type: 'interest', value: macros.interest ?? 50.0, label: 'Politika Faizi' },
    { type: 'usdtry', value: macros.usdtry ?? 35.0, label: 'USD/TRY' },
    { type: 'bist100', value: macros.bist100 ?? 9876, label: 'BIST 100' },
  ];
  res.json(arr);
}));

router.post('/sync', asyncHandler(async (req, res) => {
  await syncMacroData();
  const macros = await getMacroData();
  res.json(macros);
}));

router.post('/', validate(macroSchema), asyncHandler(async (req, res) => {
  const { type, value, note } = req.body;
  const macro = await prisma.macroIndicator.create({ data: { type, value, note } });
  res.json(macro);
}));

export default router;
