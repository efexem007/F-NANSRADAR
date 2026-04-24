
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

async function testEnrichment() {
  try {
    const result = await yahooFinance.quoteSummary('THYAO.IS', {
      modules: ['financialData', 'defaultKeyStatistics', 'balanceSheetHistory', 'incomeStatementHistory']
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e);
  }
}

testEnrichment();
