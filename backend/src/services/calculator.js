export const calculateRatios = (fundamental, currentPrice, sharesOutstanding) => {
  // fundamental objesi null/undefined ise tüm değerleri null döndür
  if (!fundamental || typeof fundamental !== 'object') {
    return {
      currentRatio: null, acidTest: null, grossMargin: null,
      netMargin: null, leverage: null, nfbToEbitda: null, fk: null, pddd: null
    };
  }

  const { currentAssets, currentLiabilities, inventory, totalAssets, equity, netSales, grossProfit, ebitda, netProfit, netFinancialDebt } = fundamental;

  // Sıfır bölme koruması ve null kontrolü
  const safeDiv = (num, den) => {
    if (num == null || den == null || den === 0 || isNaN(num) || isNaN(den)) return null;
    return num / den;
  };

  const currentRatio = safeDiv(currentAssets, currentLiabilities);
  const acidTest = currentLiabilities
    ? safeDiv((currentAssets || 0) - (inventory || 0), currentLiabilities)
    : null;
  const grossMargin = netSales != null ? safeDiv(grossProfit, netSales) * 100 : null;
  const netMargin = netSales != null ? safeDiv(netProfit, netSales) * 100 : null;
  const leverage = safeDiv(totalAssets, equity);
  const nfbToEbitda = safeDiv(netFinancialDebt || 0, ebitda);
  const fk = (currentPrice != null && sharesOutstanding != null && netProfit != null)
    ? safeDiv(currentPrice * sharesOutstanding, netProfit) : null;
  const pddd = (currentPrice != null && sharesOutstanding != null && equity != null)
    ? safeDiv(currentPrice * sharesOutstanding, equity) : null;

  const safeFixed = (val) => {
    if (val == null || isNaN(val) || !isFinite(val)) return null;
    return parseFloat(val.toFixed(2));
  };

  return {
    currentRatio: safeFixed(currentRatio),
    acidTest: safeFixed(acidTest),
    grossMargin: safeFixed(grossMargin),
    netMargin: safeFixed(netMargin),
    leverage: safeFixed(leverage),
    nfbToEbitda: safeFixed(nfbToEbitda),
    fk: safeFixed(fk),
    pddd: safeFixed(pddd)
  };
};
