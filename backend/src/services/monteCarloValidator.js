// v6.0-F-NANSRADAR Gelistirme

import { predictWeekly } from './prediction.js';

export function validateMonteCarlo(priceData, predictionWindow = 30, testCount = 50) {
  const results = [];

  for (let i = testCount; i > 0; i--) {
    const trainEnd = priceData.length - (i * predictionWindow);
    const trainData = priceData.slice(0, trainEnd);
    const actualData = priceData.slice(trainEnd, trainEnd + predictionWindow);

    if (trainData.length < 60 || actualData.length === 0) continue;

    const prediction = predictWeekly(trainData, predictionWindow);
    const actualFinal = actualData[actualData.length - 1].close;

    const withinP25P75 = actualFinal >= prediction.range.lower25 && actualFinal <= prediction.range.upper75;
    const withinP5P95 = actualFinal >= prediction.range.lower5 && actualFinal <= prediction.range.upper95;

    results.push({
      date: actualData[actualData.length - 1].date,
      actual: actualFinal,
      predicted: prediction.target,
      withinP25P75,
      withinP5P95,
      error: Math.abs(actualFinal - prediction.target) / actualFinal * 100
    });
  }

  const p25p75Accuracy = results.filter(r => r.withinP25P75).length / results.length * 100;
  const p5p95Accuracy = results.filter(r => r.withinP5P95).length / results.length * 100;
  const avgError = results.reduce((a, r) => a + r.error, 0) / results.length;

  return {
    p25p75Accuracy: parseFloat(p25p75Accuracy.toFixed(2)),
    p5p95Accuracy: parseFloat(p5p95Accuracy.toFixed(2)),
    avgError: parseFloat(avgError.toFixed(2)),
    totalTests: results.length,
    results
  };
}
