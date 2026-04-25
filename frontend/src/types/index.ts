export interface StockData {
  code: string;
  name: string;
  sector: string;
  index: string;
  price: number;
  change: number;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  marketCap: number;
  pe?: number;
  pb?: number;
  roe?: number;
  debtEquity?: number;
  signal: string;
  signalScore: number;
  riskLevel: string;
  riskScore: number;
  rsi?: number;
  macd?: number;
  ema9?: number;
  ema21?: number;
  ema50?: number;
  bollingerUpper?: number;
  bollingerLower?: number;
  support?: number;
  resistance?: number;
  weeklyChange?: number;
  monthlyChange?: number;
  yearlyChange?: number;
  sparklineData?: number[];
  isFavorite?: boolean;
  isScanned?: boolean;
}

export interface Prediction {
  period: string;
  label: string;
  optimisticPrice: number;
  basePrice: number;
  pessimisticPrice: number;
  confidence75: number;
  confidence25: number;
}

export interface PriceImpact {
  category: string;
  categoryScore: number;
  valueTL: number;
  valuePct: number;
  details: string[];
}

export interface AICommentary {
  technical: string;
  fundamental: string;
  macro: string;
  risk: string;
  outlook: string;
}

export interface BalanceSheet {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  cash: number;
  debt: number;
  year: number;
}

export interface RiskComponents {
  likidite: number;
  kaldirac: number;
  piyasa: number;
  teknik: number;
  makro: number;
  total: number;
}

export interface AlgorithmStep {
  name: string;
  weight: number;
  score: number;
  description: string;
}

export interface MarketIndex {
  name: string;
  value: number;
  change: number;
}

export interface StockSignal {
  code: string;
  name: string;
  signal: string;
  score: number;
  risk: string;
  riskScore: number;
  price: number;
  change: number;
  sector: string;
  date: string;
}

export type TimeFrame = '1d' | '1w' | '1m' | '3m' | '6m' | '1y' | '3y';
