
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// List Watchlist
router.get('/', asyncHandler(async (req, res) => {
  const items = await prisma.watchlistItem.findMany({
    where: { userId: req.user.id }
  });
  res.json(items);
}));

// Add to Watchlist
router.post('/add', asyncHandler(async (req, res) => {
  const { symbol, name, assetType, addedPrice, targetPrice, stopLoss, notes } = req.body;
  const item = await prisma.watchlistItem.upsert({
    where: { userId_symbol: { userId: req.user.id, symbol } },
    update: { name, addedPrice, targetPrice, stopLoss, notes, updatedAt: new Date() },
    create: { userId: req.user.id, symbol, name, assetType, addedPrice, targetPrice, stopLoss, notes }
  });
  res.json(item);
}));

// Update Notes
router.patch('/:symbol/notes', asyncHandler(async (req, res) => {
  const { notes } = req.body;
  const item = await prisma.watchlistItem.update({
    where: { userId_symbol: { userId: req.user.id, symbol: req.params.symbol } },
    data: { notes, updatedAt: new Date() }
  });
  res.json(item);
}));

// Delete
router.delete('/:symbol', asyncHandler(async (req, res) => {
  await prisma.watchlistItem.delete({
    where: { userId_symbol: { userId: req.user.id, symbol: req.params.symbol } }
  });
  res.json({ success: true });
}));

export default router;
