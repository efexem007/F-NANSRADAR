export const calculateRatios = (fundamental, currentPrice, sharesOutstanding) => {
  const { currentAssets, currentLiabilities, inventory, totalAssets, equity, netSales, grossProfit, ebitda, netProfit, netFinancialDebt } = fundamental;
  const currentRatio = currentAssets / currentLiabilities;
  const acidTest = (currentAssets - (inventory || 0)) / currentLiabilities;
  const grossMargin = netSales ? (grossProfit / netSales) * 100 : null;
  const netMargin = netSales ? (netProfit / netSales) * 100 : null;
  const leverage = totalAssets / equity;
  const nfbToEbitda = (netFinancialDebt || 0) / (ebitda || 1);
  const fk = (currentPrice && sharesOutstanding) ? (currentPrice * sharesOutstanding) / (netProfit || 1) : null;
  const pddd = (currentPrice && sharesOutstanding) ? (currentPrice * sharesOutstanding) / (equity || 1) : null;
  return {
    currentRatio: parseFloat(currentRatio.toFixed(2)),
    acidTest: parseFloat(acidTest.toFixed(2)),
    grossMargin: grossMargin ? parseFloat(grossMargin.toFixed(2)) : null,
    netMargin: netMargin ? parseFloat(netMargin.toFixed(2)) : null,
    leverage: parseFloat(leverage.toFixed(2)),
    nfbToEbitda: nfbToEbitda ? parseFloat(nfbToEbitda.toFixed(2)) : null,
    fk: fk ? parseFloat(fk.toFixed(2)) : null,
    pddd: pddd ? parseFloat(pddd.toFixed(2)) : null
  };
};
