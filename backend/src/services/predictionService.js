import * as ss from 'simple-statistics';
import technicalAnalysis from './technicalAnalysis.js';
import logger from '../lib/logger.js';
import { GARCHModel } from './volatilityModel.js';
import { calculateAdaptiveDrift } from './driftModel.js';
import { 
  estimateJumpParams, 
  randn, 
  calculateFullPercentiles, 
  selectRepresentativePaths,
  simulateMJD 
} from './prediction.js';

/**
 * Tahmin Servisi
 * Hisse senedi fiyat tahminleri ve trend analizi
 */

class PredictionService {
  constructor() {
    this.confidenceThreshold = process.env.PREDICTION_CONFIDENCE_THRESHOLD || 0.7;
  }

  // Linear Regression tahmini
  linearRegressionPredict(prices, daysAhead = 30) {
    if (prices.length < 30) {
      return { error: 'Yetersiz veri (en az 30 gün gerekli)' };
    }

    const data = prices.map((p, i) => [i, p.close]);
    const regression = ss.linearRegression(data);
    const regressionLine = ss.linearRegressionLine(regression);

    const predictions = [];
    const lastIndex = prices.length - 1;
    const lastPrice = prices[lastIndex].close;
    const lastDate = new Date(prices[lastIndex].date);

    for (let i = 1; i <= daysAhead; i++) {
      const predictedPrice = regressionLine(lastIndex + i);
      const futureDate = new Date(lastDate);
      futureDate.setDate(futureDate.getDate() + i);

      predictions.push({
        date: futureDate.toISOString().split('T')[0],
        predicted: parseFloat(predictedPrice.toFixed(2)),
        confidence: this.calculateConfidence(prices, regression, i),
      });
    }

    const trendSlope = regression.m;
    const rSquared = this.calculateRSquared(data, regressionLine);

    return {
      method: 'linear_regression',
      currentPrice: lastPrice,
      predictedPrice: predictions[predictions.length - 1].predicted,
      change: ((predictions[predictions.length - 1].predicted - lastPrice) / lastPrice) * 100,
      trend: trendSlope > 0 ? 'up' : trendSlope < 0 ? 'down' : 'neutral',
      strength: Math.abs(trendSlope),
      rSquared,
      confidence: this.calculateOverallConfidence(rSquared, prices.length),
      predictions,
    };
  }

  // Üstel Smoothing tahmini (Holt-Winters basitleştirilmiş)
  exponentialSmoothingPredict(prices, daysAhead = 30, alpha = 0.3, beta = 0.1) {
    if (prices.length < 30) {
      return { error: 'Yetersiz veri' };
    }

    const closes = prices.map(p => p.close);
    
    // İlk değerler
    let level = closes[0];
    let trend = closes[1] - closes[0];

    const smoothed = [level];

    // Holt's Linear Method
    for (let i = 1; i < closes.length; i++) {
      const prevLevel = level;
      level = alpha * closes[i] + (1 - alpha) * (level + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
      smoothed.push(level + trend);
    }

    const predictions = [];
    const lastPrice = closes[closes.length - 1];
    const lastDate = new Date(prices[prices.length - 1].date);

    for (let i = 1; i <= daysAhead; i++) {
      const forecast = level + (trend * i);
      const futureDate = new Date(lastDate);
      futureDate.setDate(futureDate.getDate() + i);

      predictions.push({
        date: futureDate.toISOString().split('T')[0],
        predicted: parseFloat(Math.max(0, forecast).toFixed(2)),
        confidence: parseFloat(Math.max(0.05, Math.min(1, 1 - (i * 0.02))).toFixed(3)), // v2.0: Clamp 0.05-1.0
      });
    }

    const finalPrediction = predictions[predictions.length - 1].predicted;

    return {
      method: 'exponential_smoothing',
      currentPrice: lastPrice,
      predictedPrice: finalPrediction,
      change: ((finalPrediction - lastPrice) / lastPrice) * 100,
      trend: trend > 0 ? 'up' : trend < 0 ? 'down' : 'neutral',
      strength: Math.abs(trend),
      predictions,
    };
  }

  // Monte Carlo Simülasyonu (v6.0-F-NANSRADAR)
  monteCarloSimulate(prices, daysAhead = 30, simulations = 5000, useGARCH = true, timeFrame = '1D') {
    if (prices.length < 30) {
      return { error: 'Yetersiz veri' };
    }

    const closes = prices.map(p => p.close);
    const returns = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push(Math.log(closes[i] / closes[i - 1]));
    }

    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const lastPrice = closes[closes.length - 1];
    const lastDate = new Date(prices[prices.length - 1].date);

    let sigmaForecasts;
    let garch;
    if (useGARCH) {
      try {
        garch = new GARCHModel();
        garch.fit(returns);
        // volatilityModel.js'deki forecast metodu returns ve stepsAhead parametrelerini alıyor
        sigmaForecasts = garch.forecast(returns, daysAhead);
      } catch (error) {
        logger.warn('GARCH model uygulanamadı, standart sapma kullanılıyor:', { error: error.message });
        useGARCH = false;
      }
    }

    const jumpParams = estimateJumpParams(returns);
    const allPaths = [];

    for (let s = 0; s < simulations; s++) {
      let price = lastPrice;
      const path = [price];

      for (let d = 0; d < daysAhead; d++) {
        // GARCH tahmini varsa onu kullan, yoksa tarihsel volatiliteyi kullan
        const sigma = useGARCH && sigmaForecasts ? sigmaForecasts[d] : 
                     Math.sqrt(returns.reduce((a, b) => a + (b - meanReturn) ** 2, 0) / returns.length);
        const dW = randn() * Math.sqrt(1 / 252);
        const diffusion = (meanReturn - 0.5 * sigma * sigma) * (1 / 252) + sigma * dW;
        const jumpOccur = Math.random() < jumpParams.jumpIntensity;
        const jumpSize = jumpOccur ? (jumpParams.jumpMean + jumpParams.jumpStd * randn()) : 0;
        price = price * Math.exp(diffusion + jumpSize);
        path.push(Math.max(price, 0.0001));
      }
      allPaths.push(path);
    }

    const percentiles = calculateFullPercentiles(allPaths);
    const representativePaths = selectRepresentativePaths(allPaths);
    const predictions = [];

    for (let d = 1; d <= daysAhead; d++) {
      const futureDate = new Date(lastDate);
      futureDate.setDate(futureDate.getDate() + d);
      predictions.push({
        date: futureDate.toISOString().split('T')[0],
        ...percentiles[d],
        mean: parseFloat((allPaths.reduce((a, p) => a + p[d], 0) / allPaths.length).toFixed(2))
      });
    }

    return {
      method: 'monte_carlo_mjd_garch',
      currentPrice: lastPrice,
      predictedPrice: percentiles[daysAhead][50],
      change: ((percentiles[daysAhead][50] - lastPrice) / lastPrice) * 100,
      confidence: {
        p5: percentiles[daysAhead][5],
        p25: percentiles[daysAhead][25],
        p75: percentiles[daysAhead][75],
        p95: percentiles[daysAhead][95]
      },
      representativePaths,
      predictions,
      modelParams: {
        jumpIntensity: jumpParams.jumpIntensity,
        jumpMean: jumpParams.jumpMean,
        jumpStd: jumpParams.jumpStd,
        garch: useGARCH ? { omega: garch?.omega, alpha: garch?.alpha, beta: garch?.beta } : null
      }
    };
  }

  // ARIMA benzeri tahmin (basitleştirilmiş)
  arimaPredict(prices, daysAhead = 30) {
    if (prices.length < 60) {
      return { error: 'Yetersiz veri (en az 60 gün gerekli)' };
    }

    const closes = prices.map(p => p.close);
    
    // Fark al (differencing)
    const diff = [];
    for (let i = 1; i < closes.length; i++) {
      diff.push(closes[i] - closes[i - 1]);
    }

    // Hareketli ortalama
    const maWindow = 5;
    const ma = [];
    for (let i = maWindow - 1; i < diff.length; i++) {
      const sum = diff.slice(i - maWindow + 1, i + 1).reduce((a, b) => a + b, 0);
      ma.push(sum / maWindow);
    }

    // Tahmin
    const predictions = [];
    const lastPrice = closes[closes.length - 1];
    const lastDate = new Date(prices[prices.length - 1].date);
    
    let currentPrice = lastPrice;
    const avgChange = ss.mean(ma.slice(-10));

    for (let i = 1; i <= daysAhead; i++) {
      currentPrice += avgChange;
      const futureDate = new Date(lastDate);
      futureDate.setDate(futureDate.getDate() + i);

      predictions.push({
        date: futureDate.toISOString().split('T')[0],
        predicted: parseFloat(Math.max(0, currentPrice).toFixed(2)),
        confidence: Math.max(0, 1 - (i * 0.03)),
      });
    }

    return {
      method: 'arima_simplified',
      currentPrice: lastPrice,
      predictedPrice: predictions[predictions.length - 1].predicted,
      change: ((predictions[predictions.length - 1].predicted - lastPrice) / lastPrice) * 100,
      trend: avgChange > 0 ? 'up' : avgChange < 0 ? 'down' : 'neutral',
      predictions,
    };
  }

  // Tüm tahmin metodlarını çalıştır ve konsolide et (v6.0-F-NANSRADAR)
  async comprehensivePrediction(prices, daysAhead = 30) {
    const results = {
      linear: this.linearRegressionPredict(prices, daysAhead),
      exponential: this.exponentialSmoothingPredict(prices, daysAhead),
      monteCarlo: this.monteCarloSimulate(prices, daysAhead, 5000, true),
      arima: this.arimaPredict(prices, daysAhead),
    };

    // Geçerli tahminleri filtrele
    const validPredictions = Object.values(results).filter(r => !r.error);

    if (validPredictions.length === 0) {
      return { error: 'Yetersiz veri için tahmin yapılamadı' };
    }

    // Model ağırlıkları (geçici: sabit ağırlık)
    const weightMap = {
      linear: 0.2,
      exponential: 0.2,
      monteCarlo: 0.4,
      arima: 0.2
    };

    const predictions = results.monteCarlo.predictions.map((_, dayIndex) => {
      const dayPredictions = [];
      let totalWeight = 0;

      for (const [method, result] of Object.entries(results)) {
        if (result.error) continue;
        const weight = weightMap[method] || 0.25;
        let val;
        if (result.predictions && result.predictions[dayIndex]) {
          const pred = result.predictions[dayIndex];
          val = pred.predicted || pred.p50 || pred.mean || 0;
        } else {
          val = 0;
        }
        dayPredictions.push({ value: val, weight });
        totalWeight += weight;
      }

      const consensus = totalWeight > 0 ? dayPredictions.reduce((a, p) => a + p.value * p.weight, 0) / totalWeight : 0;
      const vals = dayPredictions.map(p => p.value).filter(v => v !== 0);
      return {
        date: results.monteCarlo.predictions[dayIndex].date,
        consensus: parseFloat(consensus.toFixed(2)),
        min: vals.length ? parseFloat(Math.min(...vals).toFixed(2)) : 0,
        max: vals.length ? parseFloat(Math.max(...vals).toFixed(2)) : 0
      };
    });

    const lastPrice = prices[prices.length - 1].close;
    const finalConsensus = predictions[predictions.length - 1].consensus;

    return {
      currentPrice: lastPrice,
      predictedPrice: finalConsensus,
      changePercent: parseFloat((((finalConsensus - lastPrice) / lastPrice) * 100).toFixed(2)),
      confidence: results.monteCarlo.confidence,
      modelWeights: weightMap,
      methods: Object.keys(results).filter(k => !results[k].error),
      predictions,
      individualResults: results,
      generatedAt: new Date().toISOString(),
    };
  }

  // Teknik göstergelerle tahmin
  async technicalPrediction(prices, daysAhead = 30) {
    const indicators = technicalAnalysis.calculateAllIndicators(prices);
    const trend = technicalAnalysis.analyzeTrend(prices);
    const signals = technicalAnalysis.generateSignals(indicators);

    // Temel tahmin
    const basePrediction = await this.comprehensivePrediction(prices, daysAhead);

    if (basePrediction.error) return basePrediction;

    // Teknik ayarlamalar
    let adjustment = 0;
    
    // RSI bazlı ayarlama
    if (indicators.rsi < 30) adjustment += 2; // Aşırı satım = yukarı potansiyel
    else if (indicators.rsi > 70) adjustment -= 2; // Aşırı alım = düşüş potansiyel

    // MACD bazlı ayarlama
    if (indicators.macd && indicators.macd.histogram > 0) adjustment += 1;
    else if (indicators.macd && indicators.macd.histogram < 0) adjustment -= 1;

    // Trend bazlı ayarlama
    if (trend.direction === 'bullish') adjustment += trend.strength;
    else if (trend.direction === 'bearish') adjustment -= trend.strength;

    // Ayarlanmış tahmin
    const adjustedPredictions = basePrediction.predictions.map(p => ({
      ...p,
      adjusted: parseFloat((p.consensus * (1 + adjustment / 100)).toFixed(2)),
    }));

    return {
      ...basePrediction,
      predictions: adjustedPredictions,
      technicalFactors: {
        rsi: indicators.rsi,
        macd: indicators.macd,
        trend,
        signals,
        adjustment,
      },
    };
  }

  // Yardımcı fonksiyonlar
  calculateRSquared(data, regressionLine) {
    const yMean = ss.mean(data.map(d => d[1]));
    const ssTotal = data.reduce((sum, d) => sum + Math.pow(d[1] - yMean, 2), 0);
    const ssResidual = data.reduce((sum, d) => sum + Math.pow(d[1] - regressionLine(d[0]), 2), 0);
    return 1 - (ssResidual / ssTotal);
  }

  calculateConfidence(prices, regression, daysAhead) {
    const rSquared = this.calculateRSquared(
      prices.map((p, i) => [i, p.close]),
      ss.linearRegressionLine(regression)
    );
    const timeDecay = 1 - (daysAhead * 0.02);
    return Math.max(0, rSquared * timeDecay);
  }

  calculateOverallConfidence(rSquared, dataLength) {
    const dataQuality = Math.min(dataLength / 252, 1); // 1 yıl = maksimum
    return rSquared * dataQuality;
  }

  calculateConsensusConfidence(predictions) {
    const prices = predictions.map(p => p.predictedPrice || p.predictions[p.predictions.length - 1].predicted);
    const std = ss.standardDeviation(prices);
    const mean = ss.mean(prices);
    const cv = std / mean; // Coefficient of variation
    return Math.max(0, 1 - cv);
  }

  boxMullerTransform() {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

export default new PredictionService();
