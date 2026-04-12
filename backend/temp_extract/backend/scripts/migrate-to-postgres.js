#!/usr/bin/env node

/**
 * PostgreSQL Migration Script
 * SQLite'dan PostgreSQL'e geçiş için
 */

const { PrismaClient } = require('@prisma/client');
const logger = require('../src/lib/logger');

const prisma = new PrismaClient();

async function migrate() {
  logger.info('Migration başlatılıyor...');

  try {
    // Migration işlemleri burada yapılacak
    // Örnek: Eski verileri yeni formata dönüştürme
    
    logger.info('Migration başarıyla tamamlandı');
  } catch (error) {
    logger.error('Migration hatası:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
