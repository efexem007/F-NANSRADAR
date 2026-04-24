import jwt from 'jsonwebtoken';
import { verifyToken } from '../services/auth.js';
import prisma from '../lib/prisma.js';

export const authenticate = async (req, res, next) => {
  try {
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Yetkilendirme hatası: Token bulunamadı' });
    }

    const decoded = verifyToken(token);

    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: 'Yetkilendirme hatası: Geçersiz token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Sunucu hatası: Token doğrulanamadı' });
  }
};
