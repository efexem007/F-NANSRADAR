import OpenAI from 'openai';
import logger from '../lib/logger.js';
import cache from '../lib/cache.js';

/**
 * OpenAI Servisi
 * Finansal analiz ve tahminler için OpenAI API entegrasyonu
 */
class OpenAIService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.isEnabled = !!this.apiKey && this.apiKey !== 'your-openai-api-key-here';
    
    if (this.isEnabled) {
      try {
        this.client = new OpenAI({
          apiKey: this.apiKey,
        });
        logger.info('OpenAI servisi başlatıldı');
      } catch (error) {
        logger.error('OpenAI istemcisi oluşturulamadı:', error);
        this.isEnabled = false;
      }
    } else {
      logger.warn('OpenAI API anahtarı bulunamadı, servis devre dışı');
    }
  }

  /**
   * Finansal analiz için OpenAI'ya soru sor
   */
  async askFinancialQuestion(question, context = null) {
    if (!this.isEnabled) {
      return {
        success: false,
        error: 'OpenAI servisi devre dışı',
        suggestion: 'OPENAI_API_KEY ortam değişkenini ayarlayın',
      };
    }

    const cacheKey = `openai:financial:${Buffer.from(question).toString('base64')}`;
    
    return cache.getOrSet(cacheKey, async () => {
      try {
        const messages = [
          {
            role: 'system',
            content: `Sen bir finansal analiz uzmanısın. Türkiye Borsası (BIST) ve global finans piyasaları konusunda uzmansın.
            Kullanıcıların finansal sorularına teknik analiz, temel analiz ve piyasa psikolojisi perspektiflerinden yanıt ver.
            Yanıtların profesyonel, veri odaklı ve pratik olmalı.
            Risk yönetimi ve portföy çeşitlendirmesi konularında tavsiyelerde bulun.
            Yanıtlarını Türkçe olarak ver.`
          },
        ];

        if (context) {
          messages.push({
            role: 'user',
            content: `Bağlam: ${context}\n\nSoru: ${question}`
          });
        } else {
          messages.push({
            role: 'user',
            content: question
          });
        }

        const response = await this.client.chat.completions.create({
          model: 'gpt-4',
          messages,
          temperature: 0.7,
          max_tokens: 1000,
        });

        const answer = response.choices[0]?.message?.content || 'Yanıt alınamadı';

        return {
          success: true,
          question,
          answer,
          model: 'gpt-4',
          tokens: response.usage?.total_tokens || 0,
        };
      } catch (error) {
        logger.error('OpenAI sorgu hatası:', error);
        return {
          success: false,
          error: error.message,
          question,
        };
      }
    }, 3600); // 1 saat cache
  }

  /**
   * Hisse senedi analizi için OpenAI kullan
   */
  async analyzeStockWithAI(symbol, priceData, indicators, fundamentals = null) {
    if (!this.isEnabled) {
      return {
        success: false,
        error: 'OpenAI servisi devre dışı',
      };
    }

    const cacheKey = `openai:stock:${symbol}:${Date.now()}`;
    
    return cache.getOrSet(cacheKey, async () => {
      try {
        // Fiyat verilerini özetle
        const priceSummary = this.summarizePriceData(priceData);
        const indicatorsSummary = this.summarizeIndicators(indicators);
        
        const prompt = `
        ${symbol} hissesi için teknik analiz yap:

        Fiyat Özeti:
        - Son fiyat: ${priceSummary.lastPrice}
        - 30 günlük değişim: ${priceSummary.change30d}%
        - 90 günlük değişim: ${priceSummary.change90d}%
        - 52 hafta yüksek/düşük: ${priceSummary.high52w} / ${priceSummary.low52w}
        - Ortalama günlük işlem hacmi: ${priceSummary.avgVolume}

        Teknik Göstergeler:
        ${indicatorsSummary}

        ${fundamentals ? `Temel Analiz:
        - Piyasa Değeri: ${fundamentals.marketCap || 'Bilinmiyor'}
        - F/K Oranı: ${fundamentals.peRatio || 'Bilinmiyor'}
        - Temettü Verimi: ${fundamentals.dividendYield || 'Bilinmiyor'}%` : ''}

        Lütfen şu başlıklarda analiz yap:
        1. Kısa vadeli trend (1-4 hafta)
        2. Orta vadeli outlook (1-3 ay)
        3. Önemli destek ve direnç seviyeleri
        4. Risk seviyesi (düşük/orta/yüksek)
        5. Önerilen strateji (al/tut/sat)
        6. Stop-loss ve take-profit seviyeleri önerileri

        Yanıtını Türkçe olarak ver ve her başlık için kısa, net öneriler sun.
        `;

        const response = await this.client.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'Sen bir teknik analiz uzmanısın. Hisse senedi analizlerini RSI, MACD, hareketli ortalamalar, destek/direnç seviyeleri ve hacim analizi gibi teknik göstergelere dayanarak yapıyorsun. Yanıtların profesyonel, pratik ve işlem stratejileri içermeli.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.6,
          max_tokens: 1500,
        });

        const analysis = response.choices[0]?.message?.content || 'Analiz yapılamadı';

        return {
          success: true,
          symbol,
          analysis,
          model: 'gpt-4',
          tokens: response.usage?.total_tokens || 0,
          generatedAt: new Date().toISOString(),
        };
      } catch (error) {
        logger.error('OpenAI hisse analizi hatası:', error);
        return {
          success: false,
          error: error.message,
          symbol,
        };
      }
    }, 7200); // 2 saat cache
  }

  /**
   * Piyasa yorumu ve outlook analizi
   */
  async getMarketOutlook(market = 'BIST', context = {}) {
    if (!this.isEnabled) {
      return {
        success: false,
        error: 'OpenAI servisi devre dışı',
      };
    }

    const cacheKey = `openai:market:${market}:outlook:${Date.now()}`;
    
    return cache.getOrSet(cacheKey, async () => {
      try {
        const prompt = `
        ${market} piyasası için güncel analiz ve outlook sağla:

        Bağlam:
        - Mevcut piyasa koşulları: ${context.conditions || 'Standart'}
        - Önemli ekonomik gelişmeler: ${context.economicEvents || 'Son 1 haftada önemli gelişme yok'}
        - Küresel piyasa durumu: ${context.globalMarkets || 'Karışık'}
        - Döviz kurlarındaki hareketler: ${context.fxMovements || 'Nispeten stabil'}

        Lütfen şu başlıklarda analiz yap:
        1. Genel piyasa sentiment (risk iştahı)
        2. Sektörel performans (hangi sektörler lider/hangi sektörler geride)
        3. Teknik outlook (endeks seviyeleri, destek/dirençler)
        4. Kısa vadeli (1 hafta) beklentiler
        5. Orta vadeli (1 ay) projeksiyonlar
        6. Risk faktörleri ve dikkat edilmesi gerekenler
        7. Önerilen sektörler/hisseler (genel tavsiye)

        Yanıtını Türkçe olarak ver ve yatırımcılar için pratik öneriler içer.
        `;

        const response = await this.client.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'Sen bir piyasa analisti ve yatırım danışmanısın. Piyasa analizlerini teknik, temel ve makroekonomik faktörleri birleştirerek yapıyorsun. Yanıtların dengeli, veri odaklı ve yatırımcılar için faydalı olmalı.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000,
        });

        const outlook = response.choices[0]?.message?.content || 'Analiz yapılamadı';

        return {
          success: true,
          market,
          outlook,
          model: 'gpt-4',
          tokens: response.usage?.total_tokens || 0,
          generatedAt: new Date().toISOString(),
        };
      } catch (error) {
        logger.error('OpenAI piyasa outlook hatası:', error);
        return {
          success: false,
          error: error.message,
          market,
        };
      }
    }, 10800); // 3 saat cache
  }

  /**
   * Portföy optimizasyonu önerileri
   */
  async getPortfolioRecommendations(portfolio, riskProfile = 'medium', investmentHorizon = 'medium') {
    if (!this.isEnabled) {
      return {
        success: false,
        error: 'OpenAI servisi devre dışı',
      };
    }

    const cacheKey = `openai:portfolio:${Buffer.from(JSON.stringify(portfolio)).toString('base64').slice(0, 50)}`;
    
    return cache.getOrSet(cacheKey, async () => {
      try {
        const portfolioSummary = this.summarizePortfolio(portfolio);
        
        const prompt = `
        Portföy optimizasyonu önerileri sağla:

        Portföy Özeti:
        ${portfolioSummary}

        Yatırımcı Profili:
        - Risk toleransı: ${riskProfile}
        - Yatırım zaman dilimi: ${investmentHorizon}

        Lütfen şu başlıklarda önerilerde bulun:
        1. Portföy çeşitlendirmesi analizi (mevcut durum ve iyileştirme önerileri)
        2. Risk/yük getiri optimizasyonu
        3. Sektörel dağılım önerileri
        4. Varlık sınıfı dağılımı (hisse/tahvil/nakit/altın vb.)
        5. Önerilen yeni pozisyonlar (hangi hisseler/ETF'ler)
        6. Çıkarılması önerilen pozisyonlar
        7. Stop-loss ve pozisyon büyüklüğü önerileri
        8. Genel portföy stratejisi

        Yanıtını Türkçe olarak ver ve pratik, uygulanabilir öneriler sun.
        Risk profiline uygun önerilerde bulun.
        `;

        const response = await this.client.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'Sen bir portföy yöneticisi ve finansal danışmansın. Portföy optimizasyonu, risk yönetimi ve varlık dağılımı konularında uzmansın. Yanıtların kişiselleştirilmiş, pratik ve yatırım hedeflerine uygun olmalı.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.6,
          max_tokens: 2500,
        });

        const recommendations = response.choices[0]?.message?.content || 'Öneri alınamadı';

        return {
          success: true,
          recommendations,
          model: 'gpt-4',
          tokens: response.usage?.total_tokens || 0,
          generatedAt: new Date().toISOString(),
        };
      } catch (error) {
        logger.error('OpenAI portföy önerileri hatası:', error);
        return {
          success: false,
          error: error.message,
        };
      }
    }, 14400); // 4 saat cache
  }

  /**
   * Yardımcı fonksiyonlar
   */
  summarizePriceData(priceData) {
    if (!priceData || priceData.length === 0) {
      return {
        lastPrice: 'Bilinmiyor',
        change30d: 'Bilinmiyor',
        change90d: 'Bilinmiyor',
        high52w: 'Bilinmiyor',
        low52w: 'Bilinmiyor',
        avgVolume: 'Bilinmiyor',
      };
    }

    const closes = priceData.map(p => p.close);
    const lastPrice = closes[closes.length - 1];
    const price30dAgo = closes.length >= 30 ? closes[closes.length - 30] : closes[0];
    const price90dAgo = closes.length >= 90 ? closes[closes.length - 90] : closes[0];
    
    const change30d = ((lastPrice - price30dAgo) / price30dAgo * 100).toFixed(2);
    const change90d = ((lastPrice - price90dAgo) / price90dAgo * 100).toFixed(2);
    
    const high52w = Math.max(...closes.slice(-252)).toFixed(2);
    const low52w = Math.min(...closes.slice(-252)).toFixed(2);
    
    const volumes = priceData.map(p => p.volume || 0).filter(v => v > 0);
    const avgVolume = volumes.length > 0 
      ? (volumes.reduce((a, b) => a + b, 0) / volumes.length).toFixed(0)
      : 'Bilinmiyor';

    return {
      lastPrice: lastPrice.toFixed(2),
      change30d,
      change90d,
      high52w,
      low52w,
      avgVolume,
    };
  }

  summarizeIndicators(indicators) {
    if (!indicators) return 'Gösterge bilgisi bulunamadı';
    
    let summary = '';
    
    if (indicators.rsi !== undefined) {
      const rsiStatus = indicators.rsi < 30 ? 'Aşırı Satım' :
                       indicators.rsi > 70 ? 'Aşırı Alım' : 'Nötr';
      summary += `- RSI (14): ${indicators.rsi.toFixed(1)} - ${rsiStatus}\n`;
    }
    
    if (indicators.macd) {
      const macdSignal = indicators.macd.histogram > 0 ? 'Al' : 'Sat';
      summary += `- MACD: Histogram ${indicators.macd.histogram.toFixed(4)} - Sinyal: ${macdSignal}\n`;
    }
    
    if (indicators.sma) {
      const smaSignal = indicators.sma.goldenCross ? 'Golden Cross (Al)' :
                       indicators.sma.deathCross ? 'Death Cross (Sat)' : 'Nötr';
      summary += `- SMA: ${smaSignal}\n`;
    }
    
    if (indicators.bollinger) {
      const bbPosition = indicators.bollinger.position;
      const bbSignal = bbPosition === 'upper' ? 'Üst Band (Aşırı Alım)' :
                      bbPosition === 'lower' ? 'Alt Band (Aşırı Satım)' : 'Orta Band';
      summary += `- Bollinger: ${bbSignal}\n`;
    }
    
    return summary || 'Gösterge özeti bulunamadı';
  }

  summarizePortfolio(portfolio) {
    if (!portfolio || !Array.isArray(portfolio)) {
      return 'Portföy bilgisi bulunamadı';
    }
    
    let summary = `Toplam ${portfolio.length} pozisyon:\n`;
    
    portfolio.forEach((position, index) => {
      summary += `${index + 1}. ${position.symbol || 'Bilinmeyen'}: `;
      summary += `${position.quantity || 0} adet, `;
      summary += `Maliyet: ${position.cost || 0}, `;
      summary += `Güncel Değer: ${position.currentValue || 0}, `;
      summary += `Kar/Zarar: ${position.pnl || 0} (${position.pnlPercent || 0}%)\n`;
    });
    
    const totalValue = portfolio.reduce((sum, p) => sum + (p.currentValue || 0), 0);
    const totalCost = portfolio.reduce((sum, p) => sum + (p.cost || 0), 0);
    const totalPnl = totalValue - totalCost;
    const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost * 100).toFixed(2) : 0;
    
    summary += `\nToplam Portföy:\n`;
    summary += `- Toplam Değer: ${totalValue.toFixed(2)}\n`;
    summary += `- Toplam Maliyet: ${totalCost.toFixed(2)}\n`;
    summary += `- Toplam Kar/Zarar: ${totalPnl.toFixed(2)} (${totalPnlPercent}%)\n`;
    
    // Sektörel dağılım
    const sectors = {};
    portfolio.forEach(p => {
      const sector = p.sector || 'Bilinmeyen';
      sectors[sector] = (sectors[sector] || 0) + (p.currentValue || 0);
    });
    
    if (Object.keys(sectors).length > 0) {
      summary += `\nSektörel Dağılım:\n`;
      Object.entries(sectors).forEach(([sector, value]) => {
        const percentage = ((value / totalValue) * 100).toFixed(1);
        summary += `- ${sector}: ${value.toFixed(2)} (${percentage}%)\n`;
      });
    }
    
    return summary;
  }
}

export default new OpenAIService();
