import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate, macroSchema } from '../lib/validate.js';
const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const macros = await prisma.macroIndicator.findMany({ orderBy: { date: 'desc' }, distinct: ['type'] });
  res.json(macros);
}));

router.post('/', validate(macroSchema), asyncHandler(async (req, res) => {
  const { type, value, note } = req.body;
  const macro = await prisma.macroIndicator.create({ data: { type, value, note } });
  res.json(macro);
}));

export default router;
