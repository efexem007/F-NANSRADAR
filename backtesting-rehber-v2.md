# FinansRadar — Backtesting + Gelişmiş Tahmin Sistemi
> Keskin, çok-horizonlu tahmin ve sinyal doğruluk motoru

---

## 🎯 AMAÇ

1. AL/SAT/BEKLE sinyallerinin gerçek doğruluğunu ölç
2. Günlük / Haftalık / Aylık / Yıllık tahmin üret
3. Her tahmin için güven aralığı, hata payı ve olasılık dağılımı hesapla
4. Backtesting ile sistemin geçmiş performansını kanıtla

---

## 📁 OLUŞTURULACAK / GÜNCELLENECEk DOSYALAR

```
backend/src/services/
├── backtestEngine.js          (YENI)
├── signalAccuracy.js          (YENI)
├── multiHorizonPredictor.js   (YENI) ← Ana tahmin motoru
└── riskMetrics.js             (YENI)

backend/src/routes/
└── backtest.js                (YENI)

frontend/src/pages/
└── Backtest.jsx               (MEVCUT - Güncelle)

frontend/src/components/charts/
├── BacktestEquityCurve.jsx    (YENI)
├── SignalAccuracyChart.jsx    (YENI)
└── HorizonForecastChart.jsx   (YENI)
```

---

## 🔴 AŞAMA 1: multiHorizonPredictor.js

**Aider Komutu:**
```
> backend/src/services/multiHorizonPredictor.js oluştur, Monte Carlo MJD+GARCH kullanarak günlük (1G-5G), haftalık (1H-4H), aylık (1A-3A) ve yıllık (6A-1Y) tahminler üret, her horizon için P5/P25/P50/P75/P95 güven aralıkları hesapla, volatilite rejimi (düşük/orta/yüksek) belirle, beklenen getiri ve maksimum drawdown tahmini ekle, // v6.0-F-NANSRADAR Gelistirme etiketi kullan
```

**Beklenen Kod:**
```javascript
// v6.0-F-NANSRADAR Gelistirme

import { GARCHModel } from './volatilityModel.js';
import { calculateAdaptiveDrift } from './driftModel.js';

const HORIZONS = {
  '1G':  { days: 1,   label: '1 Gün',    tradingDays: 1 },
  '3G':  { days: 3,   label: '3 Gün',    tradingDays: 3 },
  '5G':  { days: 5,   label: '1 Hafta',  tradingDays: 5 },
  '10G': { days: 10,  label: '2 Hafta',  tradingDays: 10 },
  '1A':  { days: 21,  label: '1 Ay',     tradingDays: 21 },
  '3A':  { days: 63,  label: '3 Ay',     tradingDays: 63 },
  '6A':  { days: 126, label: '6 Ay',     tradingDays: 126 },
  '1Y':  { days: 252, label: '1 Yıl',    tradingDays: 252 }
};

function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function estimateJumpParams(returns) {
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const std = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length);
  const threshold = 2.5 * std;
  const jumps = returns.filter(r => Math.abs(r - mean) > threshold);
  return {
    jumpIntensity: jumps.length / returns.length,
    jumpMean: jumps.length > 0 ? jumps.reduce((a, b) => a + b, 0) / jumps.length : 0,
    jumpStd: jumps.length > 1
      ? Math.sqrt(jumps.reduce((a, b) => a + b ** 2, 0) / jumps.length)
      : std * 0.5
  };
}

function detectVolatilityRegime(returns) {
  const recentVol = Math.sqrt(
    returns.slice(-20).reduce((a, b) => a + b ** 2, 0) / 20
  ) * Math.sqrt(252);
  const longVol = Math.sqrt(
    returns.reduce((a, b) => a + b ** 2, 0) / returns.length
  ) * Math.sqrt(252);

  const ratio = recentVol / longVol;
  return {
    recentVolatility: parseFloat((recentVol * 100).toFixed(2)),
    historicalVolatility: parseFloat((longVol * 100).toFixed(2)),
    regime: ratio > 1.5 ? 'YÜKSEK' : ratio < 0.7 ? 'DÜŞÜK' : 'NORMAL',
    ratio: parseFloat(ratio.toFixed(2))
  };
}

function runMonteCarlo(S0, mu, sigmaBase, days, nSim, jumpParams, garchForecasts) {
  const paths = [];
  const dt = 1 / 252;

  for (let s = 0; s < nSim; s += 2) {
    // Antitetik varyans azaltma
    let price1 = S0, price2 = S0;
    const path1 = [price1], path2 = [price2];

    for (let d = 0; d < days; d++) {
      const sigma = garchForecasts ? garchForecasts[Math.min(d, garchForecasts.length - 1)] : sigmaBase;
      const z = randn();

      for (const [path, sign] of [[path1, 1], [path2, -1]]) {
        const dW = sign * z * Math.sqrt(dt);
        const drift = (mu - 0.5 * sigma ** 2) * dt;
        const diffusion = sigma * dW;
        const jumpOccur = Math.random() < jumpParams.jumpIntensity * dt;
        const jump = jumpOccur ? jumpParams.jumpMean + jumpParams.jumpStd * randn() : 0;
        const last = path[path.length - 1];
        path.push(Math.max(last * Math.exp(drift + diffusion + jump), 0.0001));
      }
    }
    paths.push(path1, path2);
  }
  return paths;
}

function calcPercentiles(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const pct = (p) => sorted[Math.floor(n * p / 100)];
  return {
    p5:  parseFloat(pct(5).toFixed(4)),
    p10: parseFloat(pct(10).toFixed(4)),
    p25: parseFloat(pct(25).toFixed(4)),
    p50: parseFloat(pct(50).toFixed(4)),
    p75: parseFloat(pct(75).toFixed(4)),
    p90: parseFloat(pct(90).toFixed(4)),
    p95: parseFloat(pct(95).toFixed(4)),
    mean: parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(4))
  };
}

function calcMaxDrawdown(path) {
  let peak = path[0], maxDD = 0;
  for (const p of path) {
    if (p > peak) peak = p;
    const dd = (peak - p) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

export async function predictAllHorizons(priceData, options = {}) {
  const { simulations = 10000 } = options;

  const closes = priceData.map(p => p.close);
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }

  const S0 = closes[closes.length - 1];
  const mu = returns.reduce((a, b) => a + b, 0) / returns.length;
  const sigma = Math.sqrt(returns.reduce((a, b) => a + (b - mu) ** 2, 0) / returns.length);
  const jumpParams = estimateJumpParams(returns);
  const volRegime = detectVolatilityRegime(returns);
  const driftInfo = calculateAdaptiveDrift(returns);

  // GARCH volatilite tahmini
  let garchForecasts = null;
  try {
    const garch = new GARCHModel();
    garch.fit(returns);
    garchForecasts = garch.forecast(returns, 252);
  } catch (e) {
    console.warn('GARCH başarısız, sabit volatilite kullanılıyor');
  }

  const results = {};

  for (const [key, horizon] of Object.entries(HORIZONS)) {
    const paths = runMonteCarlo(
      S0, mu, sigma, horizon.tradingDays, simulations,
      jumpParams, garchForecasts
    );

    const finalPrices = paths.map(p => p[p.length - 1]);
    const pctiles = calcPercentiles(finalPrices);
    const returns_ = finalPrices.map(p => (p - S0) / S0 * 100);
    const returnPctiles = calcPercentiles(returns_);

    // Drawdown analizi
    const drawdowns = paths.map(p => calcMaxDrawdown(p) * 100);
    const avgDrawdown = drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length;

    // Olasılık hesapları
    const probUp = finalPrices.filter(p => p > S0).length / finalPrices.length * 100;
    const probUp5 = finalPrices.filter(p => p > S0 * 1.05).length / finalPrices.length * 100;
    const probDown5 = finalPrices.filter(p => p < S0 * 0.95).length / finalPrices.length * 100;

    results[key] = {
      horizon: horizon.label,
      days: horizon.tradingDays,
      currentPrice: S0,
      forecast: {
        price: pctiles,
        returnPct: returnPctiles
      },
      probabilities: {
        up: parseFloat(probUp.toFixed(1)),
        up5pct: parseFloat(probUp5.toFixed(1)),
        down5pct: parseFloat(probDown5.toFixed(1))
      },
      risk: {
        avgMaxDrawdown: parseFloat(avgDrawdown.toFixed(2)),
        volatilityAnnualized: parseFloat((sigma * Math.sqrt(252) * 100).toFixed(2))
      },
      signal: returnPctiles.p50 > 2 ? 'AL' :
              returnPctiles.p50 < -2 ? 'SAT' : 'BEKLE',
      confidence: parseFloat(
        (100 - (pctiles.p95 - pctiles.p5) / S0 * 100 / 2).toFixed(1)
      )
    };
  }

  return {
    symbol: priceData[0]?.symbol,
    currentPrice: S0,
    analysisDate: new Date().toISOString(),
    volatilityRegime: volRegime,
    drift: driftInfo,
    jumpRisk: {
      intensity: parseFloat((jumpParams.jumpIntensity * 100).toFixed(2)),
      avgJumpSize: parseFloat((jumpParams.jumpMean * 100).toFixed(2))
    },
    horizons: results,
    simulations
  };
}

export async function predictSingleHorizon(priceData, horizonKey = '1A', simulations = 10000) {
  const all = await predictAllHorizons(priceData, { simulations });
  return {
    ...all,
    horizon: all.horizons[horizonKey]
  };
}
```

---

## 🔴 AŞAMA 2: backtestEngine.js

**Aider Komutu:**
```
> backend/src/services/backtestEngine.js oluştur, mevcut AL/SAT sinyallerini geçmiş veride simüle et, her sinyal için stop loss %8 take profit %15 ve holding period 5 gün kullan, equity curve, sharpe ratio, max drawdown, win rate hesapla, günlük/haftalık/aylık/yıllık zaman dilimleri için ayrı backtest sonuçları üret, // v6.0-F-NANSRADAR Gelistirme etiketi kullan
```

**Beklenen Kod:**
```javascript
// v6.0-F-NANSRADAR Gelistirme

export async function runBacktest(symbol, priceData, options = {}) {
  const {
    holdingPeriod = 5,
    stopLoss = 0.08,
    takeProfit = 0.15,
    initialCapital = 10000,
    period = 'ALL' // 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'ALL'
  } = options;

  // Teknik sinyal üret (RSI + MACD + Bollinger)
  const signals = generateSignals(priceData);
  const trades = simulateTrades(signals, priceData, { holdingPeriod, stopLoss, takeProfit });
  const metrics = calculateMetrics(trades, initialCapital);

  return {
    symbol,
    period,
    ...metrics,
    trades: trades.slice(-50) // Son 50 trade
  };
}

function generateSignals(priceData) {
  const signals = [];
  const closes = priceData.map(p => p.close);

  for (let i = 50; i < closes.length; i++) {
    // RSI hesapla (14 periyot)
    const rsiWindow = closes.slice(i - 14, i);
    const gains = [], losses = [];
    for (let j = 1; j < rsiWindow.length; j++) {
      const diff = rsiWindow[j] - rsiWindow[j - 1];
      gains.push(diff > 0 ? diff : 0);
      losses.push(diff < 0 ? Math.abs(diff) : 0);
    }
    const avgGain = gains.reduce((a, b) => a + b, 0) / gains.length;
    const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;
    const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

    // SMA20 ve SMA50
    const sma20 = closes.slice(i - 20, i).reduce((a, b) => a + b, 0) / 20;
    const sma50 = closes.slice(i - 50, i).reduce((a, b) => a + b, 0) / 50;

    // Bollinger Bands
    const bbWindow = closes.slice(i - 20, i);
    const bbMean = bbWindow.reduce((a, b) => a + b, 0) / 20;
    const bbStd = Math.sqrt(bbWindow.reduce((a, b) => a + (b - bbMean) ** 2, 0) / 20);
    const bbLower = bbMean - 2 * bbStd;
    const bbUpper = bbMean + 2 * bbStd;

    // Sinyal mantığı
    let signal = 'BEKLE';
    let score = 50;

    if (rsi < 35 && closes[i] < bbLower && sma20 > sma50 * 0.98) {
      signal = 'GÜÇLÜ AL';
      score = 85;
    } else if (rsi < 45 && sma20 > sma50) {
      signal = 'AL';
      score = 70;
    } else if (rsi > 65 && closes[i] > bbUpper) {
      signal = 'SAT';
      score = 30;
    }

    if (signal !== 'BEKLE') {
      signals.push({
        date: priceData[i].date,
        price: closes[i],
        signal,
        score,
        rsi: parseFloat(rsi.toFixed(1))
      });
    }
  }
  return signals;
}

function simulateTrades(signals, priceData, options) {
  const { holdingPeriod, stopLoss, takeProfit } = options;
  const trades = [];

  for (const signal of signals) {
    if (signal.signal !== 'AL' && signal.signal !== 'GÜÇLÜ AL') continue;

    const entryIdx = priceData.findIndex(p =>
      new Date(p.date) >= new Date(signal.date)
    );
    if (entryIdx === -1) continue;

    const entryPrice = priceData[entryIdx].close;
    let exitPrice = entryPrice;
    let exitReason = 'HOLD_PERIOD';

    for (let j = entryIdx + 1; j <= entryIdx + holdingPeriod && j < priceData.length; j++) {
      const pnl = (priceData[j].close - entryPrice) / entryPrice;
      if (pnl <= -stopLoss) {
        exitPrice = priceData[j].close;
        exitReason = 'STOP_LOSS';
        break;
      }
      if (pnl >= takeProfit) {
        exitPrice = priceData[j].close;
        exitReason = 'TAKE_PROFIT';
        break;
      }
      exitPrice = priceData[j].close;
    }

    trades.push({
      entryDate: signal.date,
      entryPrice,
      exitPrice,
      exitReason,
      returnPct: parseFloat(((exitPrice - entryPrice) / entryPrice * 100).toFixed(2)),
      signal: signal.signal,
      score: signal.score
    });
  }
  return trades;
}

function calculateMetrics(trades, initialCapital) {
  if (trades.length === 0) return { error: 'Yeterli sinyal yok' };

  const wins = trades.filter(t => t.returnPct > 0);
  const losses = trades.filter(t => t.returnPct <= 0);

  let capital = initialCapital;
  let peak = capital;
  let maxDrawdown = 0;
  const equityCurve = [{ date: trades[0].entryDate, capital }];

  for (const t of trades) {
    capital *= (1 + t.returnPct / 100);
    if (capital > peak) peak = capital;
    const dd = (peak - capital) / peak * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
    equityCurve.push({ date: t.exitDate || t.entryDate, capital: parseFloat(capital.toFixed(2)) });
  }

  const returns = trades.map(t => t.returnPct);
  const meanR = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdR = Math.sqrt(returns.reduce((a, b) => a + (b - meanR) ** 2, 0) / returns.length);

  return {
    totalTrades: trades.length,
    winRate: parseFloat((wins.length / trades.length * 100).toFixed(2)),
    avgReturn: parseFloat(meanR.toFixed(2)),
    avgWin: wins.length > 0 ? parseFloat((wins.reduce((a, t) => a + t.returnPct, 0) / wins.length).toFixed(2)) : 0,
    avgLoss: losses.length > 0 ? parseFloat((losses.reduce((a, t) => a + t.returnPct, 0) / losses.length).toFixed(2)) : 0,
    profitFactor: losses.length > 0 && losses.reduce((a, t) => a + Math.abs(t.returnPct), 0) > 0
      ? parseFloat((wins.reduce((a, t) => a + t.returnPct, 0) / losses.reduce((a, t) => a + Math.abs(t.returnPct), 0)).toFixed(2))
      : 999,
    sharpeRatio: parseFloat((stdR > 0 ? meanR / stdR * Math.sqrt(252 / trades.length * trades.length) : 0).toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    finalCapital: parseFloat(capital.toFixed(2)),
    totalReturn: parseFloat(((capital - initialCapital) / initialCapital * 100).toFixed(2)),
    stopLossHits: trades.filter(t => t.exitReason === 'STOP_LOSS').length,
    takeProfitHits: trades.filter(t => t.exitReason === 'TAKE_PROFIT').length,
    equityCurve
  };
}
```

---

## 🔴 AŞAMA 3: signalAccuracy.js

**Aider Komutu:**
```
> backend/src/services/signalAccuracy.js oluştur, mevcut SignalHistory tablosundaki geçmiş sinyalleri analiz et, her sinyal tipinin 1 gün / 5 gün / 21 gün sonraki doğruluğunu hesapla, GÜÇLÜ AL için ayrı metrik üret, skor bazlı doğruluk analizi yap (skor > 70 olanların doğruluk oranı ayrıca hesaplansın)
```

---

## 🔴 AŞAMA 4: riskMetrics.js

**Aider Komutu:**
```
> backend/src/services/riskMetrics.js oluştur, Value at Risk (VaR %95 ve %99), Expected Shortfall (CVaR), Beta katsayısı (BIST100'e göre), Sortino ratio, Calmar ratio hesaplama fonksiyonları implemente et, // v6.0-F-NANSRADAR Gelistirme etiketi kullan
```

**Beklenen Kod:**
```javascript
// v6.0-F-NANSRADAR Gelistirme

export function calculateVaR(returns, confidence = 0.95) {
  const sorted = [...returns].sort((a, b) => a - b);
  const idx = Math.floor((1 - confidence) * sorted.length);
  return {
    var95: parseFloat((sorted[Math.floor(0.05 * sorted.length)] * 100).toFixed(3)),
    var99: parseFloat((sorted[Math.floor(0.01 * sorted.length)] * 100).toFixed(3))
  };
}

export function calculateCVaR(returns, confidence = 0.95) {
  const sorted = [...returns].sort((a, b) => a - b);
  const cutoff = Math.floor((1 - confidence) * sorted.length);
  const tail = sorted.slice(0, cutoff);
  return parseFloat((tail.reduce((a, b) => a + b, 0) / tail.length * 100).toFixed(3));
}

export function calculateBeta(stockReturns, marketReturns) {
  const n = Math.min(stockReturns.length, marketReturns.length);
  const sr = stockReturns.slice(-n);
  const mr = marketReturns.slice(-n);
  const meanS = sr.reduce((a, b) => a + b, 0) / n;
  const meanM = mr.reduce((a, b) => a + b, 0) / n;
  let cov = 0, varM = 0;
  for (let i = 0; i < n; i++) {
    cov += (sr[i] - meanS) * (mr[i] - meanM);
    varM += (mr[i] - meanM) ** 2;
  }
  return parseFloat((cov / varM).toFixed(3));
}

export function calculateSortinoRatio(returns, riskFreeRate = 0) {
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const downside = returns.filter(r => r < riskFreeRate);
  const downsideStd = Math.sqrt(
    downside.reduce((a, b) => a + (b - riskFreeRate) ** 2, 0) / returns.length
  );
  return parseFloat((downsideStd > 0 ? (mean - riskFreeRate) / downsideStd * Math.sqrt(252) : 0).toFixed(3));
}

export function calculateCalmarRatio(annualReturn, maxDrawdown) {
  return parseFloat((maxDrawdown > 0 ? annualReturn / maxDrawdown : 0).toFixed(3));
}

export function fullRiskAnalysis(returns, marketReturns = null) {
  const var_ = calculateVaR(returns);
  const cvar = calculateCVaR(returns);
  const sortino = calculateSortinoRatio(returns);
  const annualReturn = returns.reduce((a, b) => a + b, 0) / returns.length * 252 * 100;

  let peak = 1, capital = 1, maxDD = 0;
  for (const r of returns) {
    capital *= (1 + r);
    if (capital > peak) peak = capital;
    const dd = (peak - capital) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    var95: var_.var95,
    var99: var_.var99,
    cvar95: cvar,
    sortinoRatio: sortino,
    calmarRatio: calculateCalmarRatio(annualReturn, maxDD * 100),
    beta: marketReturns ? calculateBeta(returns, marketReturns) : null,
    annualizedReturn: parseFloat(annualReturn.toFixed(2)),
    maxDrawdown: parseFloat((maxDD * 100).toFixed(2))
  };
}
```

---

## 🟠 AŞAMA 5: backtest.js (Route)

**Aider Komutu:**
```
> backend/src/routes/backtest.js oluştur, GET /:symbol/full endpoint'i (tüm horizon tahminleri), GET /:symbol/backtest endpoint'i (backtest çalıştır, period parametresi: daily/weekly/monthly/yearly/all), GET /:symbol/risk endpoint'i (VaR, CVaR, Beta, Sortino), GET /:symbol/accuracy endpoint'i (sinyal doğruluğu) ekle
```

---

## 🟠 AŞAMA 6: HorizonForecastChart.jsx

**Aider Komutu:**
```
> frontend/src/components/charts/HorizonForecastChart.jsx oluştur, 8 farklı zaman dilimi için (1G/3G/1H/2H/1A/3A/6A/1Y) tahmin sonuçlarını grid layout ile göster, her kart için hedef fiyat, güven aralığı, yukarı/aşağı olasılıkları ve AL/SAT/BEKLE sinyali göster, recharts kullan
```

---

## 🟠 AŞAMA 7: BacktestEquityCurve.jsx

**Aider Komutu:**
```
> frontend/src/components/charts/BacktestEquityCurve.jsx oluştur, recharts ComposedChart ile equity curve göster, başlangıç sermayesi referans çizgisi mavi, drawdown alanı kırmızı, win trades yeşil nokta, loss trades kırmızı nokta olsun
```

---

## 🟠 AŞAMA 8: SignalAccuracyChart.jsx

**Aider Komutu:**
```
> frontend/src/components/charts/SignalAccuracyChart.jsx oluştur, her sinyal tipi için 1G/5G/21G doğruluk oranlarını grouped BarChart ile göster, %50 referans çizgisi ekle, renk: yeşil>60, sarı>45, kırmızı<45
```

---

## 🟡 AŞAMA 9: Backtest.jsx Güncelleme

**Aider Komutu:**
```
> frontend/src/pages/Backtest.jsx düzenle, sembol arama ekle, zaman dilimi seçimi (daily/weekly/monthly/yearly) ekle, HorizonForecastChart / BacktestEquityCurve / SignalAccuracyChart bileşenlerini entegre et, risk metrikleri (VaR, Sortino, Beta) kart formatında göster, backtest parametreleri (stop loss, take profit, holding period) ayarlanabilir olsun
```

---

## 📊 METRİK AÇIKLAMASI

| Metrik | İyi Değer | Açıklama |
|--------|-----------|----------|
| **Win Rate** | >%55 | AL sinyallerinin gerçekleşme oranı |
| **Profit Factor** | >1.5 | Toplam kazanç / Toplam kayıp |
| **Sharpe Ratio** | >1.0 | Risk ayarlı getiri |
| **Sortino Ratio** | >1.5 | Sadece aşağı yönlü risk ile ölçüm |
| **Max Drawdown** | <%20 | En kötü düşüş senaryosu |
| **VaR %95** | Bilgi amaçlı | Günlük maksimum kayıp tahmini |
| **Beta** | ~1.0 | Piyasaya göre volatilite |
| **Calmar Ratio** | >0.5 | Yıllık getiri / Max drawdown |

---

## 🚀 BAŞLAMA KOMUTU

```
> backend/src/services/multiHorizonPredictor.js oluştur, Monte Carlo MJD+GARCH kullanarak 1G/3G/5G/10G/1A/3A/6A/1Y horizonları için tahmin üret, her horizon için P5/P25/P50/P75/P95 güven aralıkları, yukarı/aşağı olasılıkları, volatilite rejimi tespiti, adaptif drift analizi ve maksimum drawdown tahmini ekle, antitetik varyans azaltma kullan, 10000 simülasyon çalıştır, // v6.0-F-NANSRADAR Gelistirme etiketi kullan
```

---

## ⚠️ ÖNEMLİ NOTLAR

1. `multiHorizonPredictor.js` → `driftModel.js` ve `volatilityModel.js`'e bağımlı, önce onlar import edilmeli
2. BIST için yıllık volatilite genelde %25-45 arasında — bu normal
3. 1 yıllık tahminlerde güven aralığı geniş olacak — bu doğru, belirsizlik artar
4. Backtest geçmiş performansı gösterir, gelecek garantisi değildir
5. VaR hesabı için en az 60 günlük veri gerekli

---

*FinansRadar v6.0 — Gelişmiş Tahmin ve Risk Motoru*
*Oluşturma tarihi: 2026-04-21*
