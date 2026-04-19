export const calculateRatios = (fundamental, currentPrice, sharesOutstanding) => {
  const { currentAssets, currentLiabilities, inventory, totalAssets, equity, netSales, grossProfit, ebitda, netProfit, netFinancialDebt } = fundamental;
  const currentRatio = currentLiabilities ? currentAssets / currentLiabilities : null;
  const acidTest = currentLiabilities ? (currentAssets - (inventory || 0)) / currentLiabilities : null;
  const grossMargin = netSales ? (grossProfit / netSales) * 100 : null;
  const netMargin = netSales ? (netProfit / netSales) * 100 : null;
  const leverage = equity ? totalAssets / equity : null;
  const nfbToEbitda = ebitda ? (netFinancialDebt || 0) / ebitda : null;
  const fk = (currentPrice && sharesOutstanding && netProfit) ? (currentPrice * sharesOutstanding) / netProfit : null;
  const pddd = (currentPrice && sharesOutstanding && equity) ? (currentPrice * sharesOutstanding) / equity : null;
  return {
    currentRatio: currentRatio !== null ? parseFloat(currentRatio.toFixed(2)) : null,
    acidTest: acidTest !== null ? parseFloat(acidTest.toFixed(2)) : null,
    grossMargin: grossMargin !== null ? parseFloat(grossMargin.toFixed(2)) : null,
    netMargin: netMargin !== null ? parseFloat(netMargin.toFixed(2)) : null,
    leverage: leverage !== null ? parseFloat(leverage.toFixed(2)) : null,
    nfbToEbitda: nfbToEbitda !== null ? parseFloat(nfbToEbitda.toFixed(2)) : null,
    fk: fk !== null ? parseFloat(fk.toFixed(2)) : null,
    pddd: pddd !== null ? parseFloat(pddd.toFixed(2)) : null
  };
};
