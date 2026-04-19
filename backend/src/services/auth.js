import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';

// JWT_SECRET kontrolü - production'da kesinlikle env'den alınmalı
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET ortam değişkeni production ortamında zorunludur!');
}

const JWT_SECRET = process.env.JWT_SECRET || 'f1n4nsR4d4r!v5.2_S3cur3Auth:K3y-9a8b7c6d5e4f3g2h1xYz88vL';

// bcrypt round sayısını 12'ye çıkar (OWASP önerisi: 10+ rounds)
export const hashPassword = async (password) => bcrypt.hash(password, 12);
export const comparePassword = async (password, hash) => bcrypt.compare(password, hash);
export const generateToken = (userId) => jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
export const verifyToken = (token) => { try { return jwt.verify(token, JWT_SECRET); } catch { return null; } };

import { AppError, ValidationError } from '../middleware/errorHandler.js';

export const registerUser = async (email, password, name) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ValidationError('Bu e-posta adresi zaten kayıtlı.');
  const hashed = await hashPassword(password);
  const user = await prisma.user.create({ data: { email, password: hashed, name } });
  await prisma.portfolio.create({ data: { name: 'Ana Portföy', userId: user.id } });
  const token = generateToken(user.id);
  return { user: { id: user.id, email, name }, token };
};

export const loginUser = async (email, password) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError('Kullanıcı bulunamadı.', 404);
  const valid = await comparePassword(password, user.password);
  if (!valid) throw new AppError('Şifre hatalı.', 401);
  const token = generateToken(user.id);
  return { user: { id: user.id, email, name: user.name }, token };
};
