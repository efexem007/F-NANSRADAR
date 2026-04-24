
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

async function test() {
  try {
    const res = await yahooFinance.quote('THYAO.IS');
    console.log('THYAO:', res.longName);
    const summ = await yahooFinance.quoteSummary('THYAO.IS', { modules: ['financialData'] });
    console.log('THYAO Price:', summ.financialData.currentPrice);
  } catch (e) {
    console.error('Test Hatası:', e.message);
  }
}

test();
