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

// Unified signal color palette — used across Scanner, AssetRow, StockDetail, AllStocks
export const SIGNAL_COLORS = {
  'GÜÇLÜ AL': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', hex: '#10b981' },
  'GUCLU AL':  { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', hex: '#10b981' },
  'AL':        { bg: 'bg-green-500/15',   text: 'text-green-400',   border: 'border-green-500/30',   hex: '#22c55e' },
  'BEKLE':     { bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-500/30',   hex: '#f59e0b' },
  'SAT':       { bg: 'bg-orange-500/15',  text: 'text-orange-400',  border: 'border-orange-500/30',  hex: '#f97316' },
  'GÜÇLÜ SAT': { bg: 'bg-red-500/20',     text: 'text-red-400',     border: 'border-red-500/30',     hex: '#ef4444' },
  'GUCLU SAT': { bg: 'bg-red-500/20',     text: 'text-red-400',     border: 'border-red-500/30',     hex: '#ef4444' },
}

export const SIGNAL_STYLES = {
  'GÜÇLÜ AL': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  'GUCLU AL':  'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  'AL':        'bg-green-500/20 text-green-400 border-green-500/40',
  'BEKLE':     'bg-amber-500/20 text-amber-400 border-amber-500/40',
  'SAT':       'bg-pink-500/20 text-pink-400 border-pink-500/40',
  'GÜÇLÜ SAT': 'bg-red-500/20 text-red-400 border-red-500/40',
  'GUCLU SAT': 'bg-red-500/20 text-red-400 border-red-500/40',
}
