import { Router } from 'express';
import { registerUser, loginUser, verifyToken } from '../services/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
const router = Router();

router.post('/register', asyncHandler(async (req, res) => {
  const result = await registerUser(req.body.email, req.body.password, req.body.name);
  res.json(result);
}));

router.post('/login', asyncHandler(async (req, res) => {
  const result = await loginUser(req.body.email, req.body.password);
  res.json(result);
}));

router.get('/me', asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token yok' });
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Gecersiz token' });
  const user = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { id: true, email: true, name: true } });
  if (!user) return res.status(404).json({ error: 'Kullanici bulunamadi' });
  res.json(user);
}));

export default router;
