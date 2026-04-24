import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate, macroSchema } from '../lib/validate.js';
const router = Router();

import { syncMacroData, getMacroData } from '../services/macroData.js';

router.get('/', asyncHandler(async (req, res) => {
  const macros = await getMacroData();
  res.json(macros);
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
