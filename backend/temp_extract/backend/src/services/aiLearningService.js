const ss = require('simple-statistics');
const { prisma } = require('../lib/prisma');
const logger = require('../lib/logger');
const cache = require('../lib/cache');

/**
 * AI Öğrenme Servisi
 * Tahmin doğruluğunu öğrenerek sürekli iyileştirir
 */

class AILearningService {
  constructor() {
    this.learningEnabled = process.env.ENABLE_AI_LEARNING === 'true';
    this.minSamples = 10;
    this.learningRate = 0.1;
  }

  // Tahmin kaydet
  async savePrediction(data) {
    if (!this.learningEnabled) return;

    try {
      const prediction = await prisma.prediction.create({
        data: {
          symbol: data.symbol,
          method: data.method,
          predictedPrice: data.predictedPrice,
          targetDate: new Date(data.targetDate),
          confidence: data.confidence,
          features: data.features,
          marketCondition: data.marketCondition,
        },
      });

      logger.info(`Tahmin kaydedildi: ${data.symbol} - ${data.method}`);
      return prediction;
    } catch (error) {
      logger.error('Tahmin kaydetme hatası:', error);
    }
  }

  // Tahmin doğruluğunu değerlendir
  async evaluatePredictions(symbol, actualPrice) {
    if (!this.learningEnabled) return;

    try {
      // Değerlendirilmeyi bekleyen tahminleri bul
      const pendingPredictions = await prisma.prediction.findMany({
        where: {
          symbol,
          targetDate: { lte: new Date() },
          actualPrice: null,
        },
      });

      for (const pred of pendingPredictions) {
        const error = Math.abs(pred.predictedPrice - actualPrice);
        const errorPercent = (error / actualPrice) * 100;
        const accuracy = Math.max(0, 100 - errorPercent);

        await prisma.prediction.update({
          where: { id: pred.id },
          data: {
            actualPrice,
            error,
            errorPercent,
            accuracy,
            evaluatedAt: new Date(),
          },
        });

        // Model performansını güncelle
        await this.updateModelPerformance(pred.method, accuracy);
      }

      logger.info(`${pendingPredictions.length} tahmin değerlendirildi: ${symbol}`);
    } catch (error) {
      logger.error('Tahmin değerlendirme hatası:', error);
    }
  }

  // Model performansını güncelle
  async updateModelPerformance(method, accuracy) {
    try {
      const performance = await prisma.modelPerformance.findUnique({
        where: { method },
      });

      if (performance) {
        const newTotalPredictions = performance.totalPredictions + 1;
        const newAvgAccuracy = 
          (performance.avgAccuracy * performance.totalPredictions + accuracy) / newTotalPredictions;

        await prisma.modelPerformance.update({
          where: { method },
          data: {
            totalPredictions: newTotalPredictions,
            avgAccuracy: newAvgAccuracy,
            lastUpdated: new Date(),
          },
        });
      } else {
        await prisma.modelPerformance.create({
          data: {
            method,
            totalPredictions: 1,
            avgAccuracy: accuracy,
          },
        });
      }
    } catch (error) {
      logger.error('Model performans güncelleme hatası:', error);
    }
  }

  // En iyi modeli seç
  async getBestModel(symbol, marketCondition = null) {
    const cacheKey = `ai:bestModel:${symbol}:${marketCondition || 'all'}`;
    
    return cache.getOrSet(cacheKey, async () => {
      try {
        let whereClause = {};
        
        if (marketCondition) {
          whereClause.marketCondition = marketCondition;
        }

        const performances = await prisma.modelPerformance.findMany({
          where: whereClause,
          orderBy: { avgAccuracy: 'desc' },
        });

        if (performances.length === 0) {
          return { method: 'consensus', weight: 1 };
        }

        // Ağırlıklı ortalama
        const totalWeight = performances.reduce((sum, p) => sum + p.avgAccuracy, 0);
        const weightedModels = performances.map(p => ({
          method: p.method,
          weight: p.avgAccuracy / totalWeight,
          accuracy: p.avgAccuracy,
          predictions: p.totalPredictions,
        }));

        return weightedModels;
      } catch (error) {
        logger.error('En iyi model seçim hatası:', error);
        return [{ method: 'consensus', weight: 1 }];
      }
    }, 3600);
  }

  // Özellik önem analizi
  async analyzeFeatureImportance(symbol) {
    try {
      const predictions = await prisma.prediction.findMany({
        where: {
          symbol,
          accuracy: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      if (predictions.length < this.minSamples) {
        return { error: 'Yetersiz veri' };
      }

      // Özellik korelasyonları
      const features = ['rsi', 'macd', 'sma20', 'sma50', 'volume', 'volatility'];
      const correlations = {};

      for (const feature of features) {
        const featureValues = predictions
          .filter(p => p.features && p.features[feature] !== undefined)
          .map(p => p.features[feature]);
        
        const accuracies = predictions
          .filter(p => p.features && p.features[feature] !== undefined)
          .map(p => p.accuracy);

        if (featureValues.length >= this.minSamples) {
          correlations[feature] = ss.sampleCorrelation(featureValues, accuracies) || 0;
        }
      }

      // Özellik önem sıralaması
      const sortedFeatures = Object.entries(correlations)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .map(([name, correlation]) => ({
          name,
          correlation: parseFloat(correlation.toFixed(4)),
          importance: parseFloat(Math.abs(correlation).toFixed(4)),
        }));

      return {
        symbol,
        sampleSize: predictions.length,
        features: sortedFeatures,
        topFeature: sortedFeatures[0],
      };
    } catch (error) {
      logger.error('Özellik önem analizi hatası:', error);
      return { error: error.message };
    }
  }

  // Piyasa koşulu tespiti
  detectMarketCondition(prices) {
    if (prices.length < 50) return 'unknown';

    const closes = prices.map(p => p.close);
    const sma20 = ss.mean(closes.slice(-20));
    const sma50 = ss.mean(closes.slice(-50));
    
    // Volatilite
    const returns = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    const volatility = ss.standardDeviation(returns) * Math.sqrt(252) * 100;

    // Trend
    const currentPrice = closes[closes.length - 1];
    const trend = currentPrice > sma20 && sma20 > sma50 ? 'bullish' :
                  currentPrice < sma20 && sma20 < sma50 ? 'bearish' : 'sideways';

    // Volatilite seviyesi
    const volLevel = volatility > 30 ? 'high' : volatility > 15 ? 'medium' : 'low';

    return `${trend}_${volLevel}_volatility`;
  }

  // Adaptif tahmin ağırlıkları
  async getAdaptiveWeights(symbol, currentFeatures) {
    const marketCondition = this.detectMarketCondition(currentFeatures.prices);
    const bestModels = await this.getBestModel(symbol, marketCondition);

    // Geçmiş benzer koşullardaki performans
    const similarPredictions = await prisma.prediction.findMany({
      where: {
        symbol,
        marketCondition,
        accuracy: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (similarPredictions.length < this.minSamples) {
      return bestModels;
    }

    // Koşul bazlı model performansı
    const conditionPerformance = {};
    for (const pred of similarPredictions) {
      if (!conditionPerformance[pred.method]) {
        conditionPerformance[pred.method] = { total: 0, accuracy: 0 };
      }
      conditionPerformance[pred.method].total++;
      conditionPerformance[pred.method].accuracy += pred.accuracy;
    }

    // Ağırlıkları güncelle
    const adaptiveWeights = Object.entries(conditionPerformance).map(([method, data]) => ({
      method,
      weight: data.accuracy / data.total / 100,
      avgAccuracy: data.accuracy / data.total,
      sampleSize: data.total,
    }));

    return adaptiveWeights.sort((a, b) => b.weight - a.weight);
  }

  // Öğrenme istatistikleri
  async getLearningStats(symbol = null) {
    try {
      const whereClause = symbol ? { symbol } : {};

      const [totalPredictions, avgAccuracy, methodStats, recentErrors] = await Promise.all([
        prisma.prediction.count({ where: whereClause }),
        prisma.prediction.aggregate({
          where: { ...whereClause, accuracy: { not: null } },
          _avg: { accuracy: true },
        }),
        prisma.modelPerformance.findMany({
          orderBy: { avgAccuracy: 'desc' },
        }),
        prisma.prediction.findMany({
          where: { ...whereClause, accuracy: { not: null } },
          orderBy: { evaluatedAt: 'desc' },
          take: 10,
          select: { symbol: true, errorPercent: true, method: true },
        }),
      ]);

      return {
        totalPredictions,
        averageAccuracy: parseFloat((avgAccuracy._avg.accuracy || 0).toFixed(2)),
        methodPerformance: methodStats,
        recentErrors,
        learningEnabled: this.learningEnabled,
      };
    } catch (error) {
      logger.error('Öğrenme istatistikleri hatası:', error);
      return { error: error.message };
    }
  }

  // Model iyileştirme önerileri
  async getImprovementSuggestions(symbol) {
    try {
      const predictions = await prisma.prediction.findMany({
        where: {
          symbol,
          accuracy: { not: null },
        },
      });

      if (predictions.length < this.minSamples) {
        return { error: 'Yetersiz veri' };
      }

      const suggestions = [];

      // Düşük doğruluklu modelleri tespit et
      const methodAccuracy = {};
      for (const pred of predictions) {
        if (!methodAccuracy[pred.method]) {
          methodAccuracy[pred.method] = { total: 0, accuracy: 0 };
        }
        methodAccuracy[pred.method].total++;
        methodAccuracy[pred.method].accuracy += pred.accuracy;
      }

      for (const [method, data] of Object.entries(methodAccuracy)) {
        const avgAcc = data.accuracy / data.total;
        if (avgAcc < 60) {
          suggestions.push({
            type: 'low_accuracy',
            method,
            currentAccuracy: parseFloat(avgAcc.toFixed(2)),
            suggestion: `${method} modeli düşük doğruluk gösteriyor. Parametre optimizasyonu önerilir.`,
          });
        }
      }

      // Aşırı tahmin hataları
      const highErrors = predictions.filter(p => p.errorPercent > 20);
      if (highErrors.length > predictions.length * 0.3) {
        suggestions.push({
          type: 'high_variance',
          affectedPredictions: highErrors.length,
          suggestion: 'Yüksek volatilite dönemlerinde daha konservatif tahminler önerilir.',
        });
      }

      // Özellik analizi
      const featureImportance = await this.analyzeFeatureImportance(symbol);
      if (featureImportance.topFeature && featureImportance.topFeature.importance < 0.3) {
        suggestions.push({
          type: 'feature_engineering',
          topFeature: featureImportance.topFeature,
          suggestion: 'Daha güçlü özellikler keşfedilmeli. Teknik gösterge kombinasyonları denenebilir.',
        });
      }

      return {
        symbol,
        suggestions,
        totalAnalyzed: predictions.length,
      };
    } catch (error) {
      logger.error('İyileştirme önerileri hatası:', error);
      return { error: error.message };
    }
  }

  // Otomatik model kalibrasyonu
  async calibrateModel(method) {
    try {
      const predictions = await prisma.prediction.findMany({
        where: {
          method,
          accuracy: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });

      if (predictions.length < this.minSamples) {
        return { error: 'Yetersiz veri kalibrasyon için' };
      }

      // Hata analizi
      const errors = predictions.map(p => p.error);
      const meanError = ss.mean(errors);
      const stdError = ss.standardDeviation(errors);

      // Sistematik bias tespiti
      const bias = meanError;
      const calibration = {
        method,
        sampleSize: predictions.length,
        meanError: parseFloat(meanError.toFixed(4)),
        stdError: parseFloat(stdError.toFixed(4)),
        bias: parseFloat(bias.toFixed(4)),
        needsCalibration: Math.abs(bias) > stdError * 0.5,
        suggestedCorrection: parseFloat((-bias).toFixed(4)),
      };

      logger.info(`Model kalibrasyonu: ${method}`, calibration);
      return calibration;
    } catch (error) {
      logger.error('Model kalibrasyon hatası:', error);
      return { error: error.message };
    }
  }
}

module.exports = new AILearningService();
