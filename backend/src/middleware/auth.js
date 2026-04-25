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

    // Token varsa doğrula ve kullanıcıyı ata
    if (token) {
      const decoded = verifyToken(token);
      if (decoded && decoded.userId) {
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, email: true, name: true }
        });
        if (user) {
          req.user = user;
        }
      }
    }

    // Token yoksa veya geçersizse bile devam et (Auth devre dışı)
    if (!req.user) {
      req.user = { id: 1, email: 'guest@finansradar.com', name: 'Misafir' };
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    req.user = { id: 1, email: 'guest@finansradar.com', name: 'Misafir' };
    next();
  }
};
