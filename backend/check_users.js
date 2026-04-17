import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } });
console.log('Users:', JSON.stringify(users, null, 2));
if (users.length === 0) {
  console.log('No users found. Creating test user...');
  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.default.hash('test123', 10);
  const user = await prisma.user.create({
    data: { email: 'test@finansradar.com', password: hash, name: 'Test User' }
  });
  console.log('Created user:', user.email);
}
await prisma.$disconnect();
