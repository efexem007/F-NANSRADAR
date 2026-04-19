import YahooFinance from 'yahoo-finance2';
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const period1 = new Date();
period1.setFullYear(period1.getFullYear() - 3);

// Test ALL modules
const modules = ['financials', 'balance-sheet', 'cash-flow', 'income-statement'];

for (const mod of modules) {
  try {
    const data = await yf.fundamentalsTimeSeries('THYAO.IS', {
      period1: period1.toISOString(),
      type: 'annual',
      module: mod
    });
    const keys = Object.keys(data);
    const nonEmpty = keys.filter(k => Array.isArray(data[k]) && data[k].length > 0);
    console.log(`=== ${mod} => ${nonEmpty.length} dolu anahtar ===`);
    if (nonEmpty.length > 0) console.log(nonEmpty.slice(0, 5).join(', ') + '...');
    
    // Sample value
    if (nonEmpty.length > 0) {
      const sample = data[nonEmpty[0]];
      const last = sample[sample.length - 1];
      console.log(`  Örnek (${nonEmpty[0]}):`, JSON.stringify(last).slice(0, 100));
    }
  } catch(e) {
    console.log(`${mod} HATA:`, e.message.slice(0, 100));
  }
}

// Also test with quoteSummary - incomeStatementHistoryQuarterly
console.log('\n=== quoteSummary modulList test ===');
try {
  const qs = await yf.quoteSummary('THYAO.IS', {
    modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail']
  });
  console.log('financialData.totalRevenue:', qs.financialData?.totalRevenue?.raw);
  console.log('financialData.netIncomeToCommon:', qs.financialData?.netIncomeToCommon?.raw);
  console.log('financialData.totalAssets:', qs.financialData?.totalAssets?.raw);
  console.log('financialData.totalEquity:', qs.financialData?.totalEquity);
  console.log('financialData keys:', Object.keys(qs.financialData || {}).join(', '));
} catch(e) {
  console.log('quoteSummary HATA:', e.message.slice(0, 150));
}

process.exit(0);
