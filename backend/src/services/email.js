import nodemailer from 'nodemailer';
import { generatePortfolioReport, deleteTempFile } from './pdfReport.js';
import prisma from '../lib/prisma.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

export const sendWeeklyReport = async (userEmail, userName) => {
  try {
    const user = await prisma.user.findUnique({ where: { email: userEmail }, include: { portfolios: { include: { items: true } } } });
    if (!user || !user.portfolios.length) return;
    const pdfPath = await generatePortfolioReport({ user, date: new Date() });
    await transporter.sendMail({
      from: `"FinansAnaliz" <${process.env.SMTP_USER}>`,
      to: userEmail,
      subject: `Haftalik Rapor - ${new Date().toLocaleDateString('tr-TR')}`,
      text: `Sayin ${userName || userEmail}, haftalik raporunuz ekte.`,
      attachments: [{ filename: `rapor_${Date.now()}.pdf`, path: pdfPath }]
    });
    setTimeout(() => deleteTempFile(pdfPath), 5000);
  } catch (error) { console.error('E-posta hatasi:', error); }
};
