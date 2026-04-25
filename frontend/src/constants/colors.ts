export const STOCK_COLORS: Record<string, string> = {
  GARAN: '#00ff88',
  THYAO: '#8b5cf6',
  ASELS: '#f59e0b',
  EREGL: '#ec4899',
  SAHOL: '#ef4444',
  KCHOL: '#06b6d4',
  TUPRS: '#06b6d4',
  AKBNK: '#8b5cf6',
  ISCTR: '#10b981',
  YKBNK: '#3b82f6',
  SISE: '#f59e0b',
  KRDMD: '#ef4444',
  ARCLK: '#8b5cf6',
  BIAS: '#06b6d4',
  DEFAULT: '#94a3b8'
};

export const getColor = (ticker: string): string => {
  const cleanTicker = ticker.replace('.IS', '');
  return STOCK_COLORS[cleanTicker] || STOCK_COLORS.DEFAULT;
};

export const SIGNAL_COLORS: Record<string, { bg: string; text: string; border: string; hex: string }> = {
  'GÜÇLÜ AL': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', hex: '#10b981' },
  'AL': { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30', hex: '#22c55e' },
  'BEKLE': { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', hex: '#f59e0b' },
  'SAT': { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30', hex: '#f97316' },
  'GÜÇLÜ SAT': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', hex: '#ef4444' },
};

export const SIGNAL_STYLES: Record<string, string> = {
  'GÜÇLÜ AL': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  'AL': 'bg-green-500/20 text-green-400 border-green-500/40',
  'BEKLE': 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  'SAT': 'bg-pink-500/20 text-pink-400 border-pink-500/40',
  'GÜÇLÜ SAT': 'bg-red-500/20 text-red-400 border-red-500/40',
};

export const RISK_LEVELS: Record<string, { name: string; emoji: string; color: string; bgColor: string; borderColor: string }> = {
  'DÜŞÜK': { name: 'Düşük Risk', emoji: '🛡️', color: '#22c55e', bgColor: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.3)' },
  'ORTA': { name: 'Orta Risk', emoji: '🟡', color: '#eab308', bgColor: 'rgba(234,179,8,0.15)', borderColor: 'rgba(234,179,8,0.3)' },
  'YÜKSEK': { name: 'Yüksek Risk', emoji: '🟠', color: '#f97316', bgColor: 'rgba(249,115,22,0.15)', borderColor: 'rgba(249,115,22,0.3)' },
  'KRİTİK': { name: 'Kritik Risk', emoji: '🔴', color: '#ef4444', bgColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)' },
};

export const THEME = {
  bg: {
    main: '#0a0e1a',
    card: '#111827',
    hover: '#1a1f35',
    glass: 'rgba(255,255,255,0.03)',
    glassHover: 'rgba(255,255,255,0.05)',
  },
  primary: {
    purple: '#8b5cf6',
    cyan: '#06b6d4',
    gradient: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
  },
  rise: {
    green: '#10b981',
    light: '#22c55e',
  },
  fall: {
    red: '#ef4444',
    light: '#f43f5e',
  },
  text: {
    white: '#f1f5f9',
    gray: '#94a3b8',
    muted: '#64748b',
    label: '#475569',
  },
  border: 'rgba(255,255,255,0.08)',
  borderHover: 'rgba(255,255,255,0.15)',
};
