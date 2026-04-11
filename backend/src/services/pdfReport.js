import { createWriteStream } from 'fs';
import { unlink, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.join(__dirname, '../../temp');

export const generatePortfolioReport = async (data) => {
  await mkdir(TEMP_DIR, { recursive: true });
  const filename = `rapor_${Date.now()}.pdf`;
  const filepath = path.join(TEMP_DIR, filename);
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(filepath);
    stream.write('FinansAnaliz Raporu\n');
    stream.write(`Tarih: ${new Date().toLocaleString('tr-TR')}\n`);
    stream.write('Portfoy Ozeti\n');
    stream.write('Detayli rapor icin sisteme giris yapiniz.\n');
    stream.end();
    stream.on('finish', () => resolve(filepath));
    stream.on('error', reject);
  });
};

export const deleteTempFile = async (filepath) => { try { await unlink(filepath); } catch(e) {} };
