import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'gizli-anahtar';

export const hashPassword = async (password) => bcrypt.hash(password, 10);
export const comparePassword = async (password, hash) => bcrypt.compare(password, hash);
export const generateToken = (userId) => jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
export const verifyToken = (token) => { try { return jwt.verify(token, JWT_SECRET); } catch { return null; } };

export const registerUser = async (email, password, name) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('Email zaten kayitli');
  const hashed = await hashPassword(password);
  const user = await prisma.user.create({ data: { email, password: hashed, name } });
  await prisma.portfolio.create({ data: { name: 'Ana Portfoy', userId: user.id } });
  const token = generateToken(user.id);
  return { user: { id: user.id, email, name }, token };
};

export const loginUser = async (email, password) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('Kullanici bulunamadi');
  const valid = await comparePassword(password, user.password);
  if (!valid) throw new Error('Sifre hatali');
  const token = generateToken(user.id);
  return { user: { id: user.id, email, name: user.name }, token };
};
