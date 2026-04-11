export const STOCK_COLORS = {
  GARAN:  '#00ff88',
  THYAO:  '#8b5cf6',
  ASELS:  '#f59e0b',
  EREGL:  '#ec4899',
  SAHOL:  '#ef4444',
  KCHOL:  '#06b6d4',
  TUPRS:  '#06b6d4',
  AKBNK:  '#8b5cf6',
  DEFAULT: '#94a3b8'
}

export const getColor = (ticker) => STOCK_COLORS[ticker] || STOCK_COLORS.DEFAULT
