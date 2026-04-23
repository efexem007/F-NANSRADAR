import express from 'express';
const router = express.Router();
import { asyncHandler } from '../lib/asyncHandler.js';
import openaiService from '../services/openaiService.js';
import logger from '../lib/logger.js';

// OpenAI servis durumu
router.get('/status', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      enabled: openaiService.isEnabled,
      service: 'OpenAI',
      features: [
        'financial_questions',
        'stock_analysis',
        'market_outlook',
        'portfolio_recommendations'
      ]
    }
  });
}));

// Finansal soru sorma
router.post('/ask', asyncHandler(async (req, res) => {
  const { question, context } = req.body;
  
  if (!question || typeof question !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Geçerli bir soru gereklidir'
    });
  }
  
  const result = await openaiService.askFinancialQuestion(question, context);
  
  if (!result.success) {
    return res.status(500).json({
      success: false,
      error: result.error,
      suggestion: result.suggestion
    });
  }
  
  res.json({
    success: true,
    data: result
  });
}));

// Hisse senedi analizi
router.post('/analyze-stock', asyncHandler(async (req, res) => {
  const { symbol, priceData, indicators, fundamentals } = req.body;
  
  if (!symbol || !priceData || !Array.isArray(priceData)) {
    return res.status(400).json({
      success: false,
      error: 'Symbol ve priceData gereklidir'
    });
  }
  
  const result = await openaiService.analyzeStockWithAI(
    symbol.toUpperCase(),
    priceData,
    indicators,
    fundamentals
  );
  
  if (!result.success) {
    return res.status(500).json({
      success: false,
      error: result.error,
      symbol: symbol.toUpperCase()
    });
  }
  
  res.json({
    success: true,
    data: result
  });
}));

// Piyasa outlook
router.post('/market-outlook', asyncHandler(async (req, res) => {
  const { market, context } = req.body;
  
  const result = await openaiService.getMarketOutlook(
    market || 'BIST',
    context || {}
  );
  
  if (!result.success) {
    return res.status(500).json({
      success: false,
      error: result.error,
      market: market || 'BIST'
    });
  }
  
  res.json({
    success: true,
    data: result
  });
}));

// Portföy önerileri
router.post('/portfolio-recommendations', asyncHandler(async (req, res) => {
  const { portfolio, riskProfile, investmentHorizon } = req.body;
  
  if (!portfolio || !Array.isArray(portfolio)) {
    return res.status(400).json({
      success: false,
      error: 'Geçerli bir portföy listesi gereklidir'
    });
  }
  
  const result = await openaiService.getPortfolioRecommendations(
    portfolio,
    riskProfile || 'medium',
    investmentHorizon || 'medium'
  );
  
  if (!result.success) {
    return res.status(500).json({
      success: false,
      error: result.error
    });
  }
  
  res.json({
    success: true,
    data: result
  });
}));

// Test endpoint - basit soru
router.get('/test', asyncHandler(async (req, res) => {
  const testQuestion = "BIST 100 endeksi bugün neden düştü?";
  
  const result = await openaiService.askFinancialQuestion(testQuestion);
  
  if (!result.success) {
    logger.warn('OpenAI test sorgusu başarısız:', result.error);
    
    return res.json({
      success: false,
      test: 'failed',
      error: result.error,
      suggestion: 'OPENAI_API_KEY kontrol edin'
    });
  }
  
  res.json({
    success: true,
    test: 'passed',
    question: testQuestion,
    answer: result.answer.substring(0, 200) + '...',
    tokens: result.tokens,
    serviceStatus: 'operational'
  });
}));

export default router;