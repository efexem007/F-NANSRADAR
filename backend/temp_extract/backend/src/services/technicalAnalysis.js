const ss = require('simple-statistics');

/**
 * Teknik Analiz Servisi
 * Hisse senedi teknik göstergelerini hesaplar
 */

class TechnicalAnalysisService {
  
  // Basit Hareketli Ortalama (SMA)
  calculateSMA(prices, period) {
    if (prices.length < period) return null;
    const closes = prices.map(p => p.close);
    return ss.mean(closes.slice(-period));
  }

  // Üstel Hareketli Ortalama (EMA)
  calculateEMA(prices, period) {
    if (prices.length < period) return null;
    const closes = prices.map(p => p.close);
    const multiplier = 2 / (period + 1);
    
    let ema = ss.mean(closes.slice(0, period));
    
    for (let i = period; i < closes.length; i++) {
      ema = (closes[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  // Göreceli Güç Endeksi (RSI)
  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return null;
    
    const closes = prices.map(p => p.close);
    let gains = 0;
    let losses = 0;
    
    // İlk periyot
    for (let i = 1; i <= period; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    // Kalan veriler
    for (let i = period + 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;
      
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  // MACD (Moving Average Convergence Divergence)
  calculateMACD(prices, fast = 12, slow = 26, signal = 9) {
    if (prices.length < slow + signal) return null;
    
    const closes = prices.map(p => p.close);
    const ema12 = this.calculateEMA(prices, fast);
    const ema26 = this.calculateEMA(prices, slow);
    
    const macdLine = ema12 - ema26;
    
    // Signal line (9-period EMA of MACD)
    const macdValues = [];
    for (let i = slow; i <= prices.length; i++) {
      const slice = prices.slice(0, i);
      const fastEMA = this.calculateEMA(slice, fast);
      const slowEMA = this.calculateEMA(slice, slow);
      macdValues.push(fastEMA - slowEMA);
    }
    
    const signalLine = ss.mean(macdValues.slice(-signal));
    const histogram = macdLine - signalLine;
    
    return {
      macd: macdLine,
      signal: signalLine,
      histogram,
    };
  }

  // Bollinger Bantları
  calculateBollingerBands(prices, period = 20, stdDev = 2) {
    if (prices.length < period) return null;
    
    const closes = prices.map(p => p.close);
    const slice = closes.slice(-period);
    
    const sma = ss.mean(slice);
    const std = ss.standardDeviation(slice);
    
    return {
      upper: sma + (std * stdDev),
      middle: sma,
      lower: sma - (std * stdDev),
      bandwidth: ((std * stdDev * 2) / sma) * 100,
    };
  }

  // Stochastic Oscillator
  calculateStochastic(prices, kPeriod = 14, dPeriod = 3) {
    if (prices.length < kPeriod) return null;
    
    const slice = prices.slice(-kPeriod);
    const highs = slice.map(p => p.high);
    const lows = slice.map(p => p.low);
    const currentClose = prices[prices.length - 1].close;
    
    const highestHigh = Math.max(...highs);
    const lowestLow = Math.min(...lows);
    
    const range = highestHigh - lowestLow;
    const k = range === 0 ? 50 : ((currentClose - lowestLow) / range) * 100;
    
    // %D (3-period SMA of %K)
    const kValues = [];
    for (let i = kPeriod; i <= prices.length; i++) {
      const s = prices.slice(i - kPeriod, i);
      const hh = Math.max(...s.map(p => p.high));
      const ll = Math.min(...s.map(p => p.low));
      const r = hh - ll;
      kValues.push(r === 0 ? 50 : ((prices[i - 1].close - ll) / r) * 100);
    }
    
    const d = ss.mean(kValues.slice(-dPeriod));
    
    return { k, d };
  }

  // ATR (Average True Range)
  calculateATR(prices, period = 14) {
    if (prices.length < period + 1) return null;
    
    const trueRanges = [];
    
    for (let i = 1; i < prices.length; i++) {
      const high = prices[i].high;
      const low = prices[i].low;
      const prevClose = prices[i - 1].close;
      
      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    return ss.mean(trueRanges.slice(-period));
  }

  // Volume Weighted Average Price (VWAP)
  calculateVWAP(prices) {
    if (prices.length === 0) return null;
    
    let cumulativeTPV = 0;
    let cumulativeVolume = 0;
    
    for (const price of prices) {
      const typicalPrice = (price.high + price.low + price.close) / 3;
      cumulativeTPV += typicalPrice * price.volume;
      cumulativeVolume += price.volume;
    }
    
    return cumulativeVolume === 0 ? 0 : cumulativeTPV / cumulativeVolume;
  }

  // Fibonacci Retracement Seviyeleri
  calculateFibonacciLevels(prices) {
    if (prices.length < 2) return null;
    
    const highs = prices.map(p => p.high);
    const lows = prices.map(p => p.low);
    
    const high = Math.max(...highs);
    const low = Math.min(...lows);
    const diff = high - low;
    
    return {
      '0%': high,
      '23.6%': high - diff * 0.236,
      '38.2%': high - diff * 0.382,
      '50%': high - diff * 0.5,
      '61.8%': high - diff * 0.618,
      '78.6%': high - diff * 0.786,
      '100%': low,
    };
  }

  // Destek ve Direnç Seviyeleri
  calculateSupportResistance(prices, window = 5) {
    if (prices.length < window * 2 + 1) return null;
    
    const supports = [];
    const resistances = [];
    
    for (let i = window; i < prices.length - window; i++) {
      const currentLow = prices[i].low;
      const currentHigh = prices[i].high;
      
      const prevLows = prices.slice(i - window, i).map(p => p.low);
      const nextLows = prices.slice(i + 1, i + window + 1).map(p => p.low);
      
      const prevHighs = prices.slice(i - window, i).map(p => p.high);
      const nextHighs = prices.slice(i + 1, i + window + 1).map(p => p.high);
      
      // Destek
      if (currentLow < Math.min(...prevLows) && currentLow < Math.min(...nextLows)) {
        supports.push({ price: currentLow, date: prices[i].date });
      }
      
      // Direnç
      if (currentHigh > Math.max(...prevHighs) && currentHigh > Math.max(...nextHighs)) {
        resistances.push({ price: currentHigh, date: prices[i].date });
      }
    }
    
    return {
      supports: supports.slice(-5),
      resistances: resistances.slice(-5),
      closestSupport: supports.length > 0 ? supports[supports.length - 1].price : null,
      closestResistance: resistances.length > 0 ? resistances[resistances.length - 1].price : null,
    };
  }

  // Tüm göstergeleri hesapla
  calculateAllIndicators(prices) {
    const currentPrice = prices[prices.length - 1].close;
    
    return {
      price: currentPrice,
      sma: {
        '20': this.calculateSMA(prices, 20),
        '50': this.calculateSMA(prices, 50),
        '200': this.calculateSMA(prices, 200),
      },
      ema: {
        '12': this.calculateEMA(prices, 12),
        '26': this.calculateEMA(prices, 26),
      },
      rsi: this.calculateRSI(prices),
      macd: this.calculateMACD(prices),
      bollinger: this.calculateBollingerBands(prices),
      stochastic: this.calculateStochastic(prices),
      atr: this.calculateATR(prices),
      vwap: this.calculateVWAP(prices),
      fibonacci: this.calculateFibonacciLevels(prices),
      supportResistance: this.calculateSupportResistance(prices),
    };
  }

  // Trend analizi
  analyzeTrend(prices) {
    const sma20 = this.calculateSMA(prices, 20);
    const sma50 = this.calculateSMA(prices, 50);
    const sma200 = this.calculateSMA(prices, 200);
    const currentPrice = prices[prices.length - 1].close;
    
    let trend = 'neutral';
    let strength = 0;
    
    // Golden Cross / Death Cross
    if (sma50 > sma200) {
      trend = 'bullish';
      strength += 1;
    } else if (sma50 < sma200) {
      trend = 'bearish';
      strength += 1;
    }
    
    // Fiyat pozisyonu
    if (currentPrice > sma20 && sma20 > sma50) {
      strength += 1;
    } else if (currentPrice < sma20 && sma20 < sma50) {
      strength += 1;
    }
    
    return {
      direction: trend,
      strength: Math.min(strength, 3),
      sma20,
      sma50,
      sma200,
      priceVsSMA20: ((currentPrice - sma20) / sma20) * 100,
    };
  }

  // Sinyal üretimi
  generateSignals(indicators) {
    const signals = [];
    
    // RSI sinyalleri
    if (indicators.rsi < 30) {
      signals.push({ indicator: 'RSI', signal: 'buy', strength: 'strong', value: indicators.rsi });
    } else if (indicators.rsi > 70) {
      signals.push({ indicator: 'RSI', signal: 'sell', strength: 'strong', value: indicators.rsi });
    }
    
    // MACD sinyalleri
    if (indicators.macd) {
      if (indicators.macd.histogram > 0 && indicators.macd.macd > indicators.macd.signal) {
        signals.push({ indicator: 'MACD', signal: 'buy', strength: 'medium', value: indicators.macd.histogram });
      } else if (indicators.macd.histogram < 0 && indicators.macd.macd < indicators.macd.signal) {
        signals.push({ indicator: 'MACD', signal: 'sell', strength: 'medium', value: indicators.macd.histogram });
      }
    }
    
    // Bollinger sinyalleri
    if (indicators.bollinger) {
      if (indicators.price < indicators.bollinger.lower) {
        signals.push({ indicator: 'Bollinger', signal: 'buy', strength: 'medium', value: indicators.price });
      } else if (indicators.price > indicators.bollinger.upper) {
        signals.push({ indicator: 'Bollinger', signal: 'sell', strength: 'medium', value: indicators.price });
      }
    }
    
    // Stochastic sinyalleri
    if (indicators.stochastic) {
      if (indicators.stochastic.k < 20 && indicators.stochastic.d < 20) {
        signals.push({ indicator: 'Stochastic', signal: 'buy', strength: 'weak', value: indicators.stochastic.k });
      } else if (indicators.stochastic.k > 80 && indicators.stochastic.d > 80) {
        signals.push({ indicator: 'Stochastic', signal: 'sell', strength: 'weak', value: indicators.stochastic.k });
      }
    }
    
    return signals;
  }
}

module.exports = new TechnicalAnalysisService();
