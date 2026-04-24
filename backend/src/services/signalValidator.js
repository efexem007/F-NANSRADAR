// v6.0-F-NANSRADAR Gelistirme
// Sinyal Doğrulama Servisi

import logger from '../lib/logger.js';
import prisma from '../lib/prisma.js';
import * as ss from 'simple-statistics';

/**
 * Sinyal Doğrulama Servisi
 * Çoklu zaman dilimi onayı ve walk-forward backtesting ile sinyal gerçekçiliğini artırır
 */
class SignalValidator {
  constructor() {
    this.timeFrames = ['1H', '4H', '1D', '1W']; // Zaman dilimleri
    this.minConsensus = 3; // En az 3/4 zaman dilimi aynı yönde olmalı
  }

  /**
   * Çoklu zaman dilimi sinyal onayı
   * @param {Object} signal - Sinyal objesi
   * @param {Array} priceData - Fiyat verileri
   * @returns {Object} - Onaylanmış sinyal veya null
   */
  validateSignalWithMultipleTimeframes(signal, priceData) {
    try {
      if (!priceData || priceData.length < 100) {
        return { 
          ...signal, 
          validation: { 
            status: 'insufficient_data',
            reason: 'Yetersiz fiyat verisi',
            confidence: 0.3 
          } 
        };
      }

      const timeFrameSignals = [];
      
      // Her zaman dilimi için trend analizi
      for (const tf of this.timeFrames) {
        const tfData = this.resampleData(priceData, tf);
        if (tfData.length < 20) continue; // Yetersiz veri
        
        const trend = this.analyzeTrend(tfData);
        timeFrameSignals.push({
          timeFrame: tf,
          direction: trend.direction,
          strength: trend.strength,
          confidence: trend.confidence
        });
      }

      if (timeFrameSignals.length < 2) {
        return { 
          ...signal, 
          validation: { 
            status: 'insufficient_timeframes',
            reason: 'Yetersiz zaman dilimi',
            confidence: 0.4 
          } 
        };
      }

      // Konsensus kontrolü
      const directionCounts = {};
      timeFrameSignals.forEach(tf => {
        directionCounts[tf.direction] = (directionCounts[tf.direction] || 0) + 1;
      });

      const consensusDirection = Object.keys(directionCounts)
        .reduce((a, b) => directionCounts[a] > directionCounts[b] ? a : b);
      
      const consensusCount = directionCounts[consensusDirection];
      const consensusRatio = consensusCount / timeFrameSignals.length;

      // Sinyal yönü ile konsensus uyumu
      const isConsistent = consensusDirection === signal.direction;
      const consensusStrength = this.calculateConsensusStrength(timeFrameSignals);

      const validation = {
        status: consensusRatio >= 0.75 && isConsistent ? 'confirmed' : 'rejected',
        timeFrameSignals,
        consensusDirection,
        consensusRatio: parseFloat(consensusRatio.toFixed(2)),
        consensusStrength: parseFloat(consensusStrength.toFixed(2)),
        isConsistent,
        requiredConsensus: 0.75,
        achievedConsensus: consensusRatio
      };

      return {
        ...signal,
        validation,
        confidence: signal.confidence * (isConsistent ? consensusStrength : 0.3)
      };

    } catch (error) {
      logger.error('Sinyal doğrulama hatası:', error);
      return { 
        ...signal, 
        validation: { 
          status: 'error',
          reason: error.message,
          confidence: 0.1 
        } 
      };
    }
  }

  /**
   * Veriyi zaman dilimine göre yeniden örnekle
   */
  resampleData(priceData, timeFrame) {
    if (timeFrame === '1D') return priceData;
    
    const grouped = {};
    priceData.forEach(item => {
      const date = new Date(item.date);
      let key;
      
      switch(timeFrame) {
        case '1H':
          key = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()} ${date.getHours()}:00`;
          break;
        case '4H':
          const hour4 = Math.floor(date.getHours() / 4) * 4;
          key = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()} ${hour4}:00`;
          break;
        case '1W':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = `${weekStart.getFullYear()}-${weekStart.getMonth()+1}-${weekStart.getDate()}`;
          break;
        default:
          key = item.date.split('T')[0];
      }
      
      if (!grouped[key]) {
        grouped[key] = {
          date: key,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: item.volume,
          count: 1
        };
      } else {
        grouped[key].high = Math.max(grouped[key].high, item.high);
        grouped[key].low = Math.min(grouped[key].low, item.low);
        grouped[key].close = item.close;
        grouped[key].volume += item.volume;
        grouped[key].count++;
      }
    });
    
    return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * Trend analizi
   */
  analyzeTrend(priceData) {
    const closes = priceData.map(p => p.close);
    if (closes.length < 20) {
      return { direction: 'neutral', strength: 0, confidence: 0 };
    }

    // EMA'lar ile trend
    const ema9 = this.calculateEMA(closes, 9);
    const ema21 = this.calculateEMA(closes, 21);
    
    const currentEma9 = ema9[ema9.length - 1];
    const currentEma21 = ema21[ema21.length - 1];
    
    // RSI
    const rsi = this.calculateRSI(closes, 14);
    
    // Trend yönü
    let direction = 'neutral';
    let strength = 0;
    
    if (currentEma9 > currentEma21 && rsi > 50) {
      direction = 'bullish';
      strength = (currentEma9 - currentEma21) / currentEma21;
    } else if (currentEma9 < currentEma21 && rsi < 50) {
      direction = 'bearish';
      strength = (currentEma21 - currentEma9) / currentEma9;
    }
    
    // Güven seviyesi
    const emaConfidence = Math.abs(currentEma9 - currentEma21) / currentEma21;
    const rsiConfidence = Math.abs(rsi - 50) / 50;
    const confidence = Math.min(1, (emaConfidence + rsiConfidence) / 2);
    
    return {
      direction,
      strength: parseFloat(strength.toFixed(4)),
      confidence: parseFloat(confidence.toFixed(2)),
      indicators: {
        ema9: parseFloat(currentEma9.toFixed(2)),
        ema21: parseFloat(currentEma21.toFixed(2)),
        rsi: parseFloat(rsi.toFixed(1))
      }
    };
  }

  /**
   * Konsensus gücü hesapla
   */
  calculateConsensusStrength(timeFrameSignals) {
    if (timeFrameSignals.length === 0) return 0;
    
    const sameDirection = timeFrameSignals.filter(tf => 
      tf.direction === timeFrameSignals[0].direction
    ).length;
    
    const directionRatio = sameDirection / timeFrameSignals.length;
    
    // Ortalama güven
    const avgConfidence = timeFrameSignals.reduce((sum, tf) => sum + tf.confidence, 0) / timeFrameSignals.length;
    
    return directionRatio * avgConfidence;
  }

  /**
   * EMA hesapla
   */
  calculateEMA(data, period) {
    const k = 2 / (period + 1);
    const ema = [data[0]];
    
    for (let i = 1; i < data.length; i++) {
      ema.push(data[i] * k + ema[i - 1] * (1 - k));
    }
    
    return ema;
  }

  /**
   * RSI hesapla
   */
  calculateRSI(data, period) {
    if (data.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = data[i] - data[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Walk-forward backtesting
   * Geçmiş sinyallerin gerçek performansını ölçer
   */
  async walkForwardBacktest(symbol, signalType, lookbackDays = 180) {
    try {
      const predictions = await prisma.prediction.findMany({
        where: {
          symbol: symbol.toUpperCase(),
          method: signalType,
          targetDate: { 
            gte: new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000),
            lte: new Date()
          },
          actualPrice: { not: null }
        },
        orderBy: { createdAt: 'asc' },
      });

      if (predictions.length < 10) {
        return {
          success: false,
          error: 'Yetersiz geçmiş veri',
          sampleSize: predictions.length,
          minRequired: 10
        };
      }

      const results = predictions.map(pred => ({
        date: pred.targetDate,
        predictedPrice: pred.predictedPrice,
        actualPrice: pred.actualPrice,
        error: Math.abs(pred.predictedPrice - pred.actualPrice),
        errorPercent: Math.abs(pred.predictedPrice - pred.actualPrice) / pred.actualPrice * 100,
        accuracy: pred.accuracy,
        directionCorrect: pred.predictedPrice < pred.actualPrice ? 'up' : 'down'
      }));

      // İstatistikler
      const errors = results.map(r => r.errorPercent);
      const meanError = ss.mean(errors);
      const stdError = ss.standardDeviation(errors);
      
      const accuracies = results.map(r => r.accuracy).filter(a => a !== null);
      const meanAccuracy = accuracies.length > 0 ? ss.mean(accuracies) : 0;
      
      // Yanlış pozitif oranı (hata > %20)
      const falsePositives = results.filter(r => r.errorPercent > 20).length;
      const falsePositiveRate = falsePositives / results.length;

      // Yön doğruluğu
      const correctDirections = results.filter(r => 
        (r.predictedPrice < r.actualPrice && r.directionCorrect === 'up') ||
        (r.predictedPrice > r.actualPrice && r.directionCorrect === 'down')
      ).length;
      const directionAccuracy = correctDirections / results.length;

      return {
        success: true,
        symbol: symbol.toUpperCase(),
        signalType,
        sampleSize: results.length,
        periodDays: lookbackDays,
        metrics: {
          meanError: parseFloat(meanError.toFixed(2)),
          stdError: parseFloat(stdError.toFixed(2)),
          meanAccuracy: parseFloat(meanAccuracy.toFixed(1)),
          falsePositiveRate: parseFloat(falsePositiveRate.toFixed(3)),
          directionAccuracy: parseFloat(directionAccuracy.toFixed(3)),
          hitRate: parseFloat(((1 - falsePositiveRate) * 100).toFixed(1))
        },
        recentResults: results.slice(-5),
        recommendation: falsePositiveRate < 0.2 ? 'reliable' : 'unreliable'
      };

    } catch (error) {
      logger.error('Walk-forward backtest hatası:', error);
      return {
        success: false,
        error: error.message,
        symbol: symbol.toUpperCase()
      };
    }
  }

  /**
   * Sinyal güven skoru hesapla
   */
  async calculateSignalConfidence(symbol, signal, priceData) {
    try {
      // 1. Çoklu zaman dilimi onayı
      const validatedSignal = this.validateSignalWithMultipleTimeframes(signal, priceData);
      
      // 2. Walk-forward backtest
      const backtest = await this.walkForwardBacktest(symbol, signal.method || 'unknown', 90);
      
      // 3. Tarihsel performans
      const historicalAccuracy = backtest.success ? backtest.metrics.meanAccuracy / 100 : 0.5;
      
      // 4. Piyasa koşulları (basit)
      const marketCondition = this.assessMarketCondition(priceData);
      
      // Nihai güven skoru
      let confidence = 0.5; // Baz skor
      
      if (validatedSignal.validation.status === 'confirmed') {
        confidence += 0.2;
      }
      
      if (backtest.success && backtest.recommendation === 'reliable') {
        confidence += 0.15;
      }
      
      confidence *= historicalAccuracy;
      
      // Piyasa koşulu düzeltmesi
      if (marketCondition === 'high_volatility') confidence *= 0.8;
      if (marketCondition === 'stable') confidence *= 1.1;
      
      // Sinyal gücüne göre ayar
      if (signal.strength > 0.7) confidence *= 1.2;
      if (signal.strength < 0.3) confidence *= 0.8;
      
      // Clamp 0-1
      confidence = Math.max(0.1, Math.min(0.95, confidence));
      
      return {
        success: true,
        symbol: symbol.toUpperCase(),
        finalConfidence: parseFloat(confidence.toFixed(2)),
        components: {
          timeframeValidation: validatedSignal.validation.status === 'confirmed' ? 0.2 : 0,
          backtestReliability: backtest.success && backtest.recommendation === 'reliable' ? 0.15 : 0,
          historicalAccuracy: parseFloat(historicalAccuracy.toFixed(2)),
          marketCondition: marketCondition,
          signalStrength: parseFloat(signal.strength || 0.5)
        },
        validation: validatedSignal.validation,
        backtest: backtest.success ? backtest.metrics : null,
        recommendation: confidence > 0.7 ? 'high_confidence' : 
                       confidence > 0.5 ? 'medium_confidence' : 'low_confidence'
      };

    } catch (error) {
      logger.error('Sinyal güven skoru hesaplama hatası:', error);
      return {
        success: false,
        error: error.message,
        finalConfidence: 0.3
      };
    }
  }

  /**
   * Piyasa koşulu değerlendirmesi
   */
  assessMarketCondition(priceData) {
    if (priceData.length < 30) return 'unknown';
    
    const closes = priceData.map(p => p.close);
    const returns = [];
    
    for (let i = 1; i < closes.length; i++) {
      returns.push(Math.log(closes[i] / closes[i - 1]));
    }
    
    const volatility = ss.standardDeviation(returns) * Math.sqrt(252) * 100;
    
    if (volatility > 30) return 'high_volatility';
    if (volatility > 15) return 'moderate_volatility';
    return 'stable';
  }

  /**
   * Tüm sinyalleri doğrula ve sırala
   */
  async validateAndRankSignals(signals, priceDataMap) {
    const validatedSignals = [];
    
    for (const signal of signals) {
      try {
        const symbol = signal.symbol;
        const priceData = priceDataMap[symbol];
        
        if (!priceData) {
          validatedSignals.push({
            ...signal,
            validation: { status: 'no_price_data', confidence: 0.1 }
          });
          continue;
        }
        
        // Sinyal doğrulama
        const validated = this.validateSignalWithMultipleTimeframes(signal, priceData);
        
        // Güven skoru
        const confidenceResult = await this.calculateSignalConfidence(symbol, signal, priceData);
        
        validatedSignals.push({
          ...validated,
          confidenceScore: confidenceResult.success ? confidenceResult.finalConfidence : 0.3,
          validationDetails: confidenceResult
        });
        
      } catch (error) {
        logger.error(`Sinyal doğrulama hatası (${signal.symbol}):`, error);
        validatedSignals.push({
          ...signal,
          validation: { status: 'error', reason: error.message, confidence: 0.1 }
        });
      }
    }
    
    // Güven skoruna göre sırala
    return validatedSignals
      .sort((a, b) => {
        const scoreA = a.confidenceScore || 0;
        const scoreB = b.confidenceScore || 0;
        return scoreB - scoreA;
      })
      .map((sig, index) => ({
        ...sig,
        rank: index + 1,
        recommendation: (sig.confidenceScore || 0) > 0.7 ? 'STRONG_BUY' :
                      (sig.confidenceScore || 0) > 0.5 ? 'BUY' : 'HOLD'
      }));
  }
}

export default new SignalValidator();