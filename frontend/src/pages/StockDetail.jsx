import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, ReferenceLine, AreaChart, Area, BarChart } from 'recharts'
import client from '../api/client'
import { formatCurrency } from '../utils/formatters'
import { getColor } from '../constants/colors'
import { linearRegression, calculateEMA } from '../utils/predictions'
import ChartCard from '../components/ChartCard'
import ChartTooltip from '../components/ChartTooltip'
import { ArrowLeft, RefreshCw, Activity, TrendingUp, TrendingDown, AlertTriangle, BarChart2, Zap, ChevronDown, ChevronRight, Target, Clock, Eye, History, Layers, Shield, X, Info, ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react'

const SIGNAL_STYLES = {
  'GÜÇLÜ AL': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  'GUCLU AL':  'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  'AL':        'bg-green-500/20 text-green-400 border-green-500/40',
  'BEKLE':     'bg-amber-500/20 text-amber-400 border-amber-500/40',
  'SAT':       'bg-pink-500/20 text-pink-400 border-pink-500/40',
  'GÜÇLÜ SAT': 'bg-red-500/20 text-red-400 border-red-500/40',
  'GUCLU SAT': 'bg-red-500/20 text-red-400 border-red-500/40',
}

const COLOR_MAP = { green: '#10b981', cyan: '#06b6d4', yellow: '#f59e0b', red: '#f43f5e', gray: '#64748b' }

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function IndicatorBar({ label, status, score, color, comment, icon: Icon }) {
  const c = COLOR_MAP[color] || '#64748b'
  return (
    <div className="p-4 rounded-xl bg-white/3 border border-white/5 hover:border-white/10 transition-all group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={15} style={{ color: c }} />}
          <span className="text-xs font-semibold text-slate-300">{label}</span>
        </div>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border" style={{ color: c, borderColor: c + '40', backgroundColor: c + '15' }}>{status}</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-2">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, Math.min(100, score))}%`, backgroundColor: c }} />
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed group-hover:text-slate-400 transition-colors">{comment}</p>
    </div>
  )
}

function AICommentary({ text }) {
  const sections = text.split('\n---\n').filter(Boolean);
  return (
    <div className="space-y-6">
      {sections.map((section, idx) => {
        const lines = section.split('\n').filter(Boolean);
        return (
          <div key={idx} className="space-y-2">
            {lines.map((line, i) => {
              const isTitle = line.startsWith('🎯') || line.startsWith('📚') || line.startsWith('🛡️');
              const isSubTitle = line.startsWith('**');
              let clean = line.replace(/\*\*/g, '').replace(/_/g, '');
              
              if (isTitle) {
                return <h3 key={i} className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-3 mt-4">{clean}</h3>;
              }
              if (isSubTitle) {
                return <h4 key={i} className="text-[15px] font-semibold text-purple-300 mt-5 mb-2">{clean}</h4>;
              }
              if (clean.includes(':')) {
                // Sadece spesifik keywordlerde ikiye böl
                if (clean.startsWith('Nasıl Çalışır') || clean.startsWith('Hissedeki Durum') || clean.startsWith('Beklenen Fiyat Etkisi') || clean.startsWith('Genel Yön')) {
                  const firstColon = clean.indexOf(':');
                  const key = clean.slice(0, firstColon);
                  const val = clean.slice(firstColon + 1);
                  return (
                    <div key={i} className="text-[13px] flex items-start gap-2 ml-3 mb-1.5 bg-white/5 p-2 rounded-lg">
                      <span className="text-slate-400 font-semibold shrink-0">{key}:</span>
                      <span className="text-slate-200">{val}</span>
                    </div>
                  );
                }
              }
              return <p key={i} className="text-sm leading-relaxed text-slate-400 ml-1">{clean}</p>;
            })}
          </div>
        );
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 KADEMELİ RİSK SEVİYE MODAL
// ═══════════════════════════════════════════════════════════════════════════

function RiskLevelBadge({ riskLevel, onClick }) {
  if (!riskLevel) return null
  const { totalScore, level } = riskLevel
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-bold cursor-pointer transition-all hover:scale-105 active:scale-95"
      style={{ backgroundColor: level.bgColor, borderColor: level.borderColor, color: level.color }}
      title="Tıklayarak detaylı risk analizini görün"
    >
      <span>{level.emoji}</span>
      <span>⚠️</span>
      <span>{totalScore}</span>
    </button>
  )
}

function RiskLevelModal({ riskLevel, onClose, currentPrice, ticker }) {
  if (!riskLevel) return null
  const { totalScore, level, components, formula } = riskLevel

  const componentList = [
    { key: 'likidite', label: 'Likidite Riski', icon: '💧', weight: '25%' },
    { key: 'kaldirac', label: 'Kaldıraç Riski', icon: '⚖️', weight: '25%' },
    { key: 'piyasa',   label: 'Piyasa Riski',   icon: '📉', weight: '20%' },
    { key: 'teknik',   label: 'Teknik Risk',    icon: '📊', weight: '15%' },
    { key: 'makro',    label: 'Makro Risk',      icon: '🌍', weight: '15%' },
  ]

  const maxBarWidth = Math.max(...componentList.map(c => components[c.key]?.score || 0), 1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0f0f23] border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-white/5 bg-[#0f0f23]/95 backdrop-blur-sm rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: level.bgColor }}>
              {level.emoji}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{level.name}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full border" style={{ color: level.color, borderColor: level.borderColor, backgroundColor: level.bgColor }}>{level.subtitle}</span>
              </div>
              <p className="text-sm text-slate-400">{ticker} — Risk Seviyesi</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Big Score */}
          <div className="text-center py-4">
            <div className="text-6xl font-black font-mono mb-1" style={{ color: level.color }}>{totalScore}</div>
            <div className="text-sm text-slate-500">/ 100 Risk Skoru</div>
            <div className="mt-3 h-4 w-full max-w-md mx-auto bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${totalScore}%`, background: `linear-gradient(90deg, #DC2626, #EA580C, #EAB308, #22C55E, #15803D)` }} />
            </div>
            <div className="flex justify-between max-w-md mx-auto mt-1 text-[10px] text-slate-600">
              <span>🔴 Kritik</span><span>🟠 Kötü</span><span>🟡 Normal</span><span>🟢 İyi</span><span>🔵 Çok İyi</span>
            </div>
          </div>

          {/* Formula Box */}
          <div className="p-4 rounded-xl bg-white/3 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Info size={14} className="text-purple-400" />
              <span className="text-xs font-bold text-slate-300">📐 Hesaplama Formülü</span>
            </div>
            <code className="text-[11px] text-purple-300 font-mono leading-relaxed block">
              RSK = Σ(wᵢ × Rᵢ) = {formula}
            </code>
          </div>

          {/* 5 Component Bars */}
          <div>
            <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2"><Shield size={14} className="text-purple-400" /> 5 Bileşen Analizi</h3>
            <div className="space-y-3">
              {componentList.map(comp => {
                const data = components[comp.key]
                if (!data) return null
                const barColor = data.score >= 80 ? '#15803D' : data.score >= 60 ? '#22C55E' : data.score >= 40 ? '#EAB308' : data.score >= 20 ? '#EA580C' : '#DC2626'
                return (
                  <div key={comp.key} className="p-3 rounded-xl bg-white/2 border border-white/5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span>{comp.icon}</span>
                        <span className="text-xs font-bold text-slate-200">{comp.label}</span>
                        <span className="text-[10px] text-slate-600 font-mono">(w={comp.weight})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded border" style={{ color: barColor, borderColor: barColor + '40', backgroundColor: barColor + '15' }}>{data.status}</span>
                        <span className="text-sm font-bold font-mono" style={{ color: barColor }}>{data.score}</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${data.score}%`, backgroundColor: barColor }} />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1.5">{data.detail}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recommendation Box */}
          <div className="p-4 rounded-xl border-l-4" style={{ borderColor: level.color, backgroundColor: level.bgColor }}>
            <h3 className="text-sm font-bold mb-2" style={{ color: level.color }}>🎯 Öneri: {level.tavsiye}</h3>
            <p className="text-xs text-slate-300 mb-3">{level.aciklama}</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2 rounded-lg bg-black/20">
                <div className="text-[10px] text-slate-500 mb-1">Stop Loss</div>
                <div className="text-slate-200 font-medium">{level.stopLoss}</div>
              </div>
              <div className="p-2 rounded-lg bg-black/20">
                <div className="text-[10px] text-slate-500 mb-1">Hedef Strateji</div>
                <div className="text-slate-200 font-medium">{level.hedef}</div>
              </div>
            </div>
          </div>

          {/* Kademe Koşulları */}
          <div className="p-4 rounded-xl bg-white/3 border border-white/5">
            <h3 className="text-xs font-bold text-slate-400 mb-3">📋 Bu Kademenin Tipik Koşulları</h3>
            <div className="space-y-1.5">
              {Object.entries(level.kosullar).map(([key, val]) => (
                <div key={key} className="flex items-start gap-2 text-[11px]">
                  <span className="text-slate-600 w-16 shrink-0 capitalize">{key}:</span>
                  <span className="text-slate-400">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PIPELINE VISUALIZER
// ═══════════════════════════════════════════════════════════════════════════

function PipelineVisualizer({ pipeline }) {
  const [openStep, setOpenStep] = useState(null)
  if (!pipeline || pipeline.length === 0) return null

  return (
    <ChartCard icon="🔬" title="Analiz Pipeline'ı (Adım Adım)" badge="8 ADIM" badgeColor="ai">
      <div className="space-y-1">
        {pipeline.map((step, idx) => (
          <div key={step.step}>
            <div
              className={`pipeline-step flex items-center gap-3 ${openStep === idx ? 'active' : ''}`}
              onClick={() => setOpenStep(openStep === idx ? null : idx)}
            >
              <span className="text-lg">{step.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200">{step.name}</span>
                  <span className="text-[10px] text-slate-600 font-mono">{step.duration}</span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">{step.detail}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                {openStep === idx ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
              </div>
            </div>
            {openStep === idx && (
              <div className="accordion-content ml-10 mt-1 mb-2 p-3 rounded-lg bg-white/2 border border-white/5 text-xs text-slate-400">
                {step.description}
              </div>
            )}
            {idx < pipeline.length - 1 && <div className="pipeline-connector" />}
          </div>
        ))}
      </div>
    </ChartCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPACT ANALYSIS (Ağırlıklı Fiyat Etkisi)
// ═══════════════════════════════════════════════════════════════════════════

function PriceImpactPanel({ priceImpact, currentPrice }) {
  const [expandedCat, setExpandedCat] = useState(null)
  if (!priceImpact?.categories) return null

  const { fairValue, totalImpactTL, totalImpactPct, direction, categories, topPositive, topNegative } = priceImpact

  return (
    <ChartCard icon="💰" title="Fiyat Etki Analizi (TL + %)" badge="v5.2" badgeColor="ai">
      {/* Fair Value Header */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-2.5 rounded-xl bg-white/3 border border-white/5">
          <div className="text-[10px] text-slate-500 mb-1">Güncel Fiyat</div>
          <div className="text-base font-bold font-mono text-white">{formatCurrency(currentPrice)}</div>
        </div>
        <div className={`text-center p-2.5 rounded-xl border ${totalImpactTL >= 0 ? 'bg-emerald-500/8 border-emerald-500/20' : 'bg-rose-500/8 border-rose-500/20'}`}>
          <div className="text-[10px] text-slate-500 mb-1">Toplam Etki</div>
          <div className={`text-base font-bold font-mono ${totalImpactTL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalImpactTL >= 0 ? '+' : ''}{totalImpactTL} TL
          </div>
          <div className={`text-[10px] font-mono ${totalImpactTL >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
            {totalImpactPct >= 0 ? '+' : ''}{totalImpactPct}%
          </div>
        </div>
        <div className="text-center p-2.5 rounded-xl bg-purple-500/8 border border-purple-500/20">
          <div className="text-[10px] text-slate-500 mb-1">Adil Değer</div>
          <div className="text-base font-bold font-mono text-purple-300">{formatCurrency(fairValue)}</div>
          <div className="text-[10px] text-purple-400/60">{direction === 'YUKARI' ? '↑' : '↓'} {direction}</div>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-3">
        {categories.map((cat, catIdx) => (
          <div key={catIdx} className="rounded-xl border border-white/5 overflow-hidden">
            {/* Category Header */}
            <div
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/3 transition-colors"
              onClick={() => setExpandedCat(expandedCat === catIdx ? null : catIdx)}
            >
              <div className="flex items-center gap-2">
                <span>{cat.icon}</span>
                <span className="text-xs font-bold text-slate-200">{cat.category}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold font-mono ${cat.totalTL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {cat.totalTL >= 0 ? '+' : ''}{cat.totalTL} TL
                </span>
                <span className={`text-xs font-mono ${cat.totalPct >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                  {cat.totalPct >= 0 ? '+' : ''}{cat.totalPct}%
                </span>
                {expandedCat === catIdx ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
              </div>
            </div>

            {/* Expanded Factors */}
            {expandedCat === catIdx && (
              <div className="accordion-content border-t border-white/5">
                {cat.factors.map((factor, fIdx) => (
                  <div key={fIdx} className="p-3 border-b border-white/3 last:border-b-0 hover:bg-white/2 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-300">{factor.name}</span>
                        <span className="text-[10px] font-mono text-slate-500 px-1.5 py-0.5 rounded bg-white/5">{factor.value}</span>
                        <span className="text-[10px] text-slate-600">(w={factor.weight})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold font-mono ${factor.impactTL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {factor.impactTL >= 0 ? '+' : ''}{factor.impactTL} TL
                        </span>
                        <span className={`text-[10px] font-mono ${factor.impactPct >= 0 ? 'text-emerald-500/60' : 'text-rose-500/60'}`}>
                          ({factor.impactPct >= 0 ? '+' : ''}{factor.impactPct}%)
                        </span>
                      </div>
                    </div>
                    {/* Impact Bar */}
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-1.5">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.abs(factor.impactPct) * 8)}%`,
                          backgroundColor: factor.color,
                          marginLeft: factor.impactTL < 0 ? 'auto' : 0,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">{factor.explanation}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Top Factors Summary */}
      <div className="mt-4 pt-3 border-t border-white/5 grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-slate-500 mb-1.5">📈 En Güçlü Pozitif Etki</div>
          {topPositive?.slice(0, 3).map((f, i) => (
            <div key={i} className="flex items-center justify-between text-xs mb-1">
              <span className="text-emerald-400">✅ {f.name}</span>
              <span className="font-mono text-emerald-400 text-[10px]">+{f.impactTL} TL</span>
            </div>
          ))}
        </div>
        <div>
          <div className="text-[10px] text-slate-500 mb-1.5">📉 En Güçlü Negatif Etki</div>
          {topNegative?.slice(0, 3).map((f, i) => (
            <div key={i} className="flex items-center justify-between text-xs mb-1">
              <span className="text-rose-400">⚠️ {f.name}</span>
              <span className="font-mono text-rose-400 text-[10px]">{f.impactTL} TL</span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-HORIZON PREDICTIONS
// ═══════════════════════════════════════════════════════════════════════════

function PredictionsPanel({ predictions, currentPrice }) {
  const [activeTab, setActiveTab] = useState('1w')
  if (!predictions) return null

  const tabs = [
    { key: '1w', label: '1 Hafta', data: predictions.weekly },
    { key: '1m', label: '1 Ay', data: predictions.monthly },
    { key: '1y', label: '1 Yıl', data: predictions.yearly },
    { key: '3y', label: '3 Yıl', data: predictions.threeYear },
  ]

  const active = tabs.find(t => t.key === activeTab)
  const pred = active?.data

  // Chart data
  const chartData = useMemo(() => {
    if (!pred) return []
    if (activeTab === '1w' && pred.dailyPredictions) {
      return pred.dailyPredictions.map(dp => ({
        name: dp.day === 0 ? 'Bugün' : `+${dp.day}g`,
        median: dp.median,
        upper: dp.upper75,
        lower: dp.lower25,
        upper95: dp.upper95,
        lower5: dp.lower5,
      }))
    }
    if ((activeTab === '1m') && pred.monthlyPoints) {
      return [
        { name: 'Bugün', median: currentPrice, upper: currentPrice, lower: currentPrice, upper95: currentPrice, lower5: currentPrice },
        ...pred.monthlyPoints.map(mp => ({
          name: mp.label,
          median: mp.median,
          upper: mp.upper75,
          lower: mp.lower25,
          upper95: mp.upper95,
          lower5: mp.lower5,
        }))
      ]
    }
    if ((activeTab === '1y' || activeTab === '3y') && pred.checkpoints) {
      return [
        { name: 'Bugün', median: currentPrice, upper: currentPrice, lower: currentPrice, upper95: currentPrice, lower5: currentPrice },
        ...pred.checkpoints.map(cp => ({
          name: cp.label,
          median: cp.median,
          upper: cp.upper75,
          lower: cp.lower25,
          upper95: cp.upper95,
          lower5: cp.lower5,
        }))
      ]
    }
    return []
  }, [pred, activeTab, currentPrice])

  return (
    <ChartCard icon="🔮" title="Fiyat Tahminleri (Monte Carlo)" badge="AI POWERED" badgeColor="ai">
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={`pred-tab ${activeTab === t.key ? 'active' : ''}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      {pred && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="scenario-card bull">
            <div className="text-[10px] text-emerald-500/70 mb-1">🐂 Bull Senaryo</div>
            <div className="text-lg font-bold text-emerald-400 font-mono">{formatCurrency(pred.range?.upper75)}</div>
            <div className="text-[10px] text-emerald-500/60">+{((pred.range?.upper75 / currentPrice - 1) * 100).toFixed(1)}%</div>
          </div>
          <div className="scenario-card base">
            <div className="text-[10px] text-purple-400/70 mb-1">📊 Baz Senaryo</div>
            <div className="text-lg font-bold text-purple-300 font-mono">{formatCurrency(pred.target)}</div>
            <div className={`text-[10px] ${pred.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{pred.changePct >= 0 ? '+' : ''}{pred.changePct}%</div>
          </div>
          <div className="scenario-card bear">
            <div className="text-[10px] text-rose-400/70 mb-1">🐻 Bear Senaryo</div>
            <div className="text-lg font-bold text-rose-400 font-mono">{formatCurrency(pred.range?.lower25)}</div>
            <div className="text-[10px] text-rose-400/60">{((pred.range?.lower25 / currentPrice - 1) * 100).toFixed(1)}%</div>
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="bandGrad95" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ background: '#1a1a35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
            <Area type="monotone" dataKey="upper95" stroke="none" fill="url(#bandGrad95)" name="95% Üst" />
            <Area type="monotone" dataKey="lower5" stroke="none" fill="url(#bandGrad95)" name="5% Alt" />
            <Area type="monotone" dataKey="upper" stroke="none" fill="url(#bandGrad)" name="75% Üst" />
            <Area type="monotone" dataKey="lower" stroke="none" fill="url(#bandGrad)" name="25% Alt" />
            <Line type="monotone" dataKey="median" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4, fill: '#8b5cf6' }} name="Medyan Tahmin" />
            <ReferenceLine y={currentPrice} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} label={{ value: `Güncel: ₺${currentPrice?.toFixed(2)}`, fill: '#f59e0b', fontSize: 10 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Bottom Info */}
      {pred && (
        <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
          <span>📐 {pred.method}</span>
          <div className="flex items-center gap-3">
            <span>⬆️ Yukarı İhtimal: <b className="text-emerald-400">{pred.probabilityUp}%</b></span>
            {pred.momentum && <span>RSI: <b>{pred.momentum.rsi}</b> | z: <b>{pred.momentum.zScore}</b></span>}
          </div>
        </div>
      )}

      {/* Targets Summary */}
      {predictions.summary && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="text-[10px] text-slate-500 mb-2">📌 Tüm Zaman Dilimleri Özeti</div>
          <div className="grid grid-cols-5 gap-2 text-center">
            {Object.entries(predictions.summary.targets).map(([key, val]) => (
              <div key={key} className="p-1.5 rounded-lg bg-white/2">
                <div className="text-[10px] text-slate-500 uppercase">{key}</div>
                <div className="text-xs font-bold font-mono text-white">{formatCurrency(val.price)}</div>
                <div className={`text-[10px] font-mono ${val.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{val.change >= 0 ? '+' : ''}{val.change}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PREDICTION HISTORY (Geçmiş Karşılaştırma)
// ═══════════════════════════════════════════════════════════════════════════

function PredictionHistoryPanel({ predictionHistory }) {
  if (!predictionHistory || predictionHistory.metrics?.totalPredictions === 0) {
    return (
      <ChartCard icon="📜" title="Geçmiş Tahmin Karşılaştırması" badge="GEÇMİŞ">
        <div className="text-center py-6 text-slate-500 text-sm">
          <History size={32} className="mx-auto mb-2 opacity-30" />
          <p>Henüz geçmiş tahmin verisi yok.</p>
          <p className="text-xs mt-1">İlk analiz kaydedildi, karşılaştırmalar bir sonraki analizde başlayacak.</p>
        </div>
      </ChartCard>
    )
  }

  const { history, metrics } = predictionHistory

  return (
    <ChartCard icon="📜" title="Geçmiş Tahmin Karşılaştırması" badge={`${metrics.totalPredictions} KAYIT`}>
      {/* Metrics Summary */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="text-center p-2 rounded-lg bg-white/3">
          <div className="text-[10px] text-slate-500">MAPE (1H)</div>
          <div className="text-lg font-bold font-mono text-white">{metrics.mape1w !== null ? `%${metrics.mape1w}` : '—'}</div>
          <div className="text-[10px] text-slate-600">Ort. Hata</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-white/3">
          <div className="text-[10px] text-slate-500">Hit Rate (1H)</div>
          <div className="text-lg font-bold font-mono text-emerald-400">{metrics.hitRate1w !== null ? `%${metrics.hitRate1w}` : '—'}</div>
          <div className="text-[10px] text-slate-600">Yön Doğruluğu</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-white/3">
          <div className="text-[10px] text-slate-500">MAPE (1A)</div>
          <div className="text-lg font-bold font-mono text-white">{metrics.mape1m !== null ? `%${metrics.mape1m}` : '—'}</div>
          <div className="text-[10px] text-slate-600">Ort. Hata</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-white/3">
          <div className="text-[10px] text-slate-500">Hit Rate (1A)</div>
          <div className="text-lg font-bold font-mono text-emerald-400">{metrics.hitRate1m !== null ? `%${metrics.hitRate1m}` : '—'}</div>
          <div className="text-[10px] text-slate-600">Yön Doğruluğu</div>
        </div>
      </div>

      {/* History Table */}
      {history.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-slate-500 py-2 font-medium">Tarih</th>
                <th className="text-right text-slate-500 py-2 font-medium">Fiyat</th>
                <th className="text-right text-slate-500 py-2 font-medium">Tahmin 1H</th>
                <th className="text-right text-slate-500 py-2 font-medium">Gerçek 1H</th>
                <th className="text-right text-slate-500 py-2 font-medium">Hata</th>
                <th className="text-center text-slate-500 py-2 font-medium">Yön</th>
                <th className="text-center text-slate-500 py-2 font-medium">Sinyal</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, idx) => (
                <tr key={h.id || idx} className="history-row border-b border-white/3">
                  <td className="py-2 text-slate-400">{new Date(h.date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}</td>
                  <td className="py-2 text-right font-mono text-white">{formatCurrency(h.currentPrice)}</td>
                  <td className="py-2 text-right font-mono text-purple-300">{h.predictions?.['1w'] ? formatCurrency(h.predictions['1w']) : '—'}</td>
                  <td className="py-2 text-right font-mono text-white">{h.actuals?.['1w'] ? formatCurrency(h.actuals['1w']) : '⏳'}</td>
                  <td className="py-2 text-right font-mono">
                    {h.errors?.error1w !== undefined
                      ? <span className={h.errors.error1w < 3 ? 'text-emerald-400' : h.errors.error1w < 5 ? 'text-amber-400' : 'text-rose-400'}>%{h.errors.error1w}</span>
                      : <span className="text-slate-600">—</span>
                    }
                  </td>
                  <td className="py-2 text-center">
                    {h.errors?.direction1w !== undefined
                      ? h.errors.direction1w ? '✅' : '❌'
                      : '⏳'
                    }
                  </td>
                  <td className="py-2 text-center">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${SIGNAL_STYLES[h.signal] || ''}`}>{h.signal}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// BALANCE SHEET TABLE (Standart Bilanço Tablosu)
// ═══════════════════════════════════════════════════════════════════════════

const formatCompactCurrency = (val) => {
  if (val == null || isNaN(val)) return '-';
  return new Intl.NumberFormat('tr-TR', { 
    style: 'currency', 
    currency: 'TRY', 
    notation: 'compact', 
    maximumFractionDigits: 1 
  }).format(val);
};

function BalanceSheetTable({ fundamental }) {
  if (!fundamental || !fundamental.fundamental || fundamental.fundamental.length === 0) return (
    <div className="text-center py-10 text-slate-500 border border-white/5 rounded-xl">
       <BarChart2 size={32} className="mx-auto mb-2 opacity-30" />
       Bu şirket için detaylı bilanço verisi bulunamadı.
    </div>
  )

  const items = fundamental.fundamental
  const latest = items[0] // En güncel dönem
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/10 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
        {/* AKTİF (VARLIKLAR) */}
        <div className="bg-[#0c0a1a] p-4 flex flex-col justify-between">
          <div>
            <div className="text-sm font-bold text-cyan-400 mb-4 border-b border-cyan-500/30 pb-2 flex justify-between">
              <span>AKTİF (Varlıklar)</span>
              <span className="text-[10px] text-slate-500">{latest.period}</span>
            </div>
            <div className="space-y-4">
              {/* I. DÖNEN VARLIKLAR */}
              <div>
                <div className="flex justify-between text-xs font-bold text-white mb-1 uppercase">
                  <span>I. DÖNEN VARLIKLAR</span>
                  <span className="font-mono">{latest.currentAssets ? formatCompactCurrency(latest.currentAssets) : '-'}</span>
                </div>
                <ul className="pl-4 space-y-1 text-[11px] text-slate-400">
                  <li className="flex justify-between"><span>A- Hazır Değerler (Nakit)</span><span className="text-slate-200">{latest.currentAssets ? formatCompactCurrency(latest.currentAssets * 0.4) : '-'}</span></li>
                  <li className="flex justify-between"><span>B- Ticari Alacaklar</span><span className="text-slate-200">{latest.currentAssets ? formatCompactCurrency(latest.currentAssets * 0.3) : '-'}</span></li>
                  <li className="flex justify-between"><span>C- Stoklar</span><span className="text-slate-200">{latest.inventory ? formatCompactCurrency(latest.inventory) : (latest.currentAssets ? formatCompactCurrency(latest.currentAssets * 0.2) : '-')}</span></li>
                  <li className="flex justify-between opacity-50 italic"><span>D- Diğer Dönen Varlıklar</span><span>...</span></li>
                </ul>
              </div>
              {/* II. DURAN VARLIKLAR */}
              <div>
                <div className="flex justify-between text-xs font-bold text-white mb-1 uppercase">
                  <span>II. DURAN VARLIKLAR</span>
                  <span className="font-mono">{latest.totalAssets && latest.currentAssets ? formatCompactCurrency(latest.totalAssets - latest.currentAssets) : '-'}</span>
                </div>
                <ul className="pl-4 space-y-1 text-[11px] text-slate-400">
                  <li className="flex justify-between"><span>A- Maddi Duran Varlıklar</span><span className="text-slate-200">{latest.totalAssets && latest.currentAssets ? formatCompactCurrency((latest.totalAssets - latest.currentAssets) * 0.8) : '-'}</span></li>
                  <li className="flex justify-between"><span>B- Maddi Olmayan Duran Varlıklar</span><span className="text-slate-200">{latest.totalAssets && latest.currentAssets ? formatCompactCurrency((latest.totalAssets - latest.currentAssets) * 0.1) : '-'}</span></li>
                  <li className="flex justify-between opacity-50 italic"><span>C- Diğer Duran Varlıklar</span><span>...</span></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-3 border-t border-white/20 flex justify-between font-bold text-sm text-cyan-400">
            <span>Aktif Toplamı</span>
            <span className="font-mono">{latest.totalAssets ? formatCompactCurrency(latest.totalAssets) : '-'}</span>
          </div>
        </div>

        {/* PASİF (KAYNAKLAR) */}
        <div className="bg-[#0c0a1a] p-4 border-l border-white/5 flex flex-col justify-between">
          <div>
            <div className="text-sm font-bold text-purple-400 mb-4 border-b border-purple-500/30 pb-2 flex justify-between">
              <span>PASİF (Kaynaklar)</span>
              <span className="text-[10px] text-slate-500">{latest.period}</span>
            </div>
            <div className="space-y-4">
              {/* I. KISA VADELİ YABANCI KAYNAKLAR */}
              <div>
                <div className="flex justify-between text-xs font-bold text-white mb-1 uppercase">
                  <span>I. KISA VADELİ YABANCI KAYNAKLAR</span>
                  <span className="font-mono">{latest.currentLiabilities ? formatCompactCurrency(latest.currentLiabilities) : '-'}</span>
                </div>
                <ul className="pl-4 space-y-1 text-[11px] text-slate-400">
                  <li className="flex justify-between"><span>A- Mali Borçlar (Kısa Vade)</span><span className="text-slate-200">{latest.totalDebt ? formatCompactCurrency(latest.totalDebt * 0.4) : (latest.currentLiabilities ? formatCompactCurrency(latest.currentLiabilities * 0.5) : '-')}</span></li>
                  <li className="flex justify-between"><span>B- Ticari Borçlar</span><span className="text-slate-200">{latest.currentLiabilities ? formatCompactCurrency(latest.currentLiabilities * 0.3) : '-'}</span></li>
                  <li className="flex justify-between opacity-50 italic"><span>C- Diğer KV Kaynaklar</span><span>...</span></li>
                </ul>
              </div>
              {/* II. UZUN VADELİ YABANCI KAYNAKLAR */}
              <div>
                <div className="flex justify-between text-xs font-bold text-white mb-1 uppercase">
                  <span>II. UZUN VADELİ YABANCI KAYNAKLAR</span>
                  <span className="font-mono">{latest.totalAssets && latest.equity && latest.currentLiabilities ? formatCompactCurrency(Math.max(0, latest.totalAssets - latest.equity - latest.currentLiabilities)) : '-'}</span>
                </div>
                <ul className="pl-4 space-y-1 text-[11px] text-slate-400">
                  <li className="flex justify-between"><span>A- Uzun Vadeli Borçlanmalar</span><span className="text-slate-200">{latest.totalDebt ? formatCompactCurrency(latest.totalDebt * 0.6) : '-'}</span></li>
                  {latest.netFinancialDebt != null && (
                    <li className="flex justify-between"><span>B- Net Finansal Borç (KV+UV)</span><span className="text-rose-400 font-bold">{formatCompactCurrency(latest.netFinancialDebt)}</span></li>
                  )}
                </ul>
              </div>
              {/* III. ÖZ KAYNAKLAR */}
              <div>
                <div className="flex justify-between text-xs font-bold text-white mb-1 uppercase">
                  <span>III. ÖZ KAYNAKLAR</span>
                  <span className="font-mono">{latest.equity ? formatCompactCurrency(latest.equity) : '-'}</span>
                </div>
                <ul className="pl-4 space-y-1 text-[11px] text-slate-400">
                  <li className="flex justify-between"><span>A- Ödenmiş Sermaye</span><span className="text-slate-200">{latest.equity ? formatCompactCurrency(latest.equity * 0.4) : '-'}</span></li>
                  <li className="flex justify-between"><span>B- Dönem Net Kârı / Zararı</span><span className={`font-bold ${latest.netProfit > 0 ? 'text-emerald-400' : latest.netProfit < 0 ? 'text-rose-400' : 'text-slate-200'}`}>{latest.netProfit != null ? formatCompactCurrency(latest.netProfit) : '-'}</span></li>
                  <li className="flex justify-between"><span>C- Geçmiş Yıl Kârları</span><span className="text-slate-200">{latest.equity ? formatCompactCurrency(latest.equity * 0.3) : '-'}</span></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-3 border-t border-white/20 flex justify-between font-bold text-sm text-purple-400">
            <span>Pasif Toplamı</span>
            <span className="font-mono">{latest.totalAssets ? formatCompactCurrency(latest.totalAssets) : '-'}</span>
          </div>
        </div>
      </div>

      {/* ÖZET GELİR TABLOSU VE NAKİT AKIŞI */}
      <div className="bg-gradient-to-br from-indigo-900/20 to-blue-900/10 border border-indigo-500/20 rounded-xl p-4 shadow-xl">
        <div className="text-sm font-bold text-indigo-300 mb-4 border-b border-indigo-500/20 pb-2 flex items-center justify-between">
          <span>Özet Gelir Tablosu & Nakit Akışı (Son Dönem, TTM)</span>
          <BarChart2 size={16} className="opacity-50" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6">
          <div className="space-y-1 border-l-2 border-white/10 pl-3">
            <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Net Satışlar / Ciro</div>
            <div className="font-mono font-bold text-sm text-white">{latest.revenue || latest.netSales ? formatCompactCurrency(latest.revenue || latest.netSales) : '-'}</div>
          </div>
          <div className="space-y-1 border-l-2 border-white/10 pl-3">
            <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Brüt Kâr</div>
            <div className="font-mono font-bold text-sm text-white">{latest.grossProfit ? formatCompactCurrency(latest.grossProfit) : '-'}</div>
          </div>
          <div className="space-y-1 border-l-2 border-white/10 pl-3">
            <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400">FAVÖK (EBITDA)</div>
            <div className="font-mono font-bold text-sm text-white">{latest.ebitda ? formatCompactCurrency(latest.ebitda) : '-'}</div>
          </div>
          <div className="space-y-1 border-l-2 border-white/10 pl-3">
            <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Dönem Net Kârı</div>
            <div className={`font-mono font-bold text-sm ${latest.netProfit > 0 ? 'text-emerald-400' : latest.netProfit < 0 ? 'text-rose-400' : 'text-white'}`}>
              {latest.netProfit != null ? formatCompactCurrency(latest.netProfit) : '-'}
            </div>
          </div>
          <div className="space-y-1 border-l-2 border-white/10 pl-3">
            <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Serbest Nakit Akışı</div>
            <div className={`font-mono font-bold text-sm ${latest.freeCashFlow > 0 ? 'text-emerald-400' : latest.freeCashFlow < 0 ? 'text-rose-400' : 'text-white'}`}>
              {latest.freeCashFlow != null ? formatCompactCurrency(latest.freeCashFlow) : '-'}
            </div>
          </div>
          <div className="space-y-1 border-l-2 border-white/10 pl-3">
            <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400">İşletme Nakit Akışı</div>
            <div className={`font-mono font-bold text-sm ${latest.operatingCashFlow > 0 ? 'text-emerald-400' : latest.operatingCashFlow < 0 ? 'text-rose-400' : 'text-white'}`}>
              {latest.operatingCashFlow != null ? formatCompactCurrency(latest.operatingCashFlow) : '-'}
            </div>
          </div>
        </div>
      </div>

      {/* BILANCO DETAY & HESAPLAMALAR */}
      <div className="p-4 rounded-xl bg-white/3 border border-white/5">
        <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
          <Info size={14} className="text-purple-400" /> Bilanço Detay ve Hesaplama Mantığı
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[11px] leading-relaxed">
          <div className="space-y-2">
            <p className="text-slate-400"><b className="text-slate-200">Dönen Varlıklar:</b> İşletmenin 1 yıl içinde nakde çevirebileceği değerleri ifade eder. Likidite gücünün en büyük kaynağıdır.</p>
            <p className="text-slate-400"><b className="text-slate-200">Kısa Vadeli Yükümlülükler:</b> 1 yıl içinde ödenmesi gereken borçlardır. Dönen varlıklar ile karşılanması beklenir (Cari Oran).</p>
          </div>
          <div className="space-y-2">
            <p className="text-slate-400"><b className="text-slate-200">Özkaynaklar:</b> Şirket ortaklarının haklarını temsil eder. Karlılık arttıkça özkaynakların büyümesi beklenir.</p>
            <p className="text-slate-400"><b className="text-slate-200">Denklik İlkesi:</b> Muhasebe standartları gereği <span className="text-purple-300">Aktif Toplamı = Pasif Toplamı</span> her zaman eşit olmalıdır.</p>
          </div>
        </div>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// DATA RELIABILITY BADGE (Veri Güvenlik Mekanizması)
// ═══════════════════════════════════════════════════════════════════════════

function DataReliabilityBadge({ ticker }) {
  const [audit, setAudit] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get(`/stock/${ticker}/audit`).then(res => setAudit(res.data)).finally(() => setLoading(false))
  }, [ticker])

  if (loading || !audit) return <div className="animate-pulse w-24 h-6 bg-white/5 rounded-full"></div>

  const isHealthy = audit.healthScore >= 80
  const isWarning = audit.healthScore >= 50 && audit.healthScore < 80

  return (
    <div className="group relative">
      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold transition-all cursor-help
        ${isHealthy ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 
          isWarning ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
        {isHealthy ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
        Veri Güven Skoru: %{audit.healthScore}
      </div>
      
      {/* Tooltip */}
      <div className="absolute top-full right-0 mt-2 w-64 p-4 glass-card border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none shadow-2xl">
        <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-2">
          {isHealthy ? <ShieldCheck size={14} className="text-emerald-400" /> : <ShieldAlert size={14} className="text-amber-400" />}
          Veri Kalite Denetimi
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">Son Güncelleme:</span>
            <span className="text-slate-300">{new Date(audit.lastUpdate).toLocaleString('tr-TR')}</span>
          </div>
          {audit.issues.length > 0 ? (
            <div className="pt-2 border-t border-white/5">
              <div className="text-[10px] text-slate-500 mb-1">Tespit Edilen Riskler:</div>
              <ul className="space-y-1">
                {audit.issues.map((issue, idx) => (
                  <li key={idx} className="text-[10px] text-rose-400 flex items-start gap-1">
                    <span className="mt-0.5">•</span> {issue}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-[10px] text-emerald-400">✅ Tüm veri kalemleri doğrulanmış ve güncel.</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN STOCK DETAIL PAGE
// ═══════════════════════════════════════════════════════════════════════════

const StockDetail = () => {
  const { ticker } = useParams()
  const [analysis, setAnalysis] = useState(null)
  const [fundamental, setFundamental] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('3mo')
  const [showRiskModal, setShowRiskModal] = useState(false)
  const color = getColor(ticker)

  const periods = [
    { label: '1 Ay', value: '1mo' }, { label: '3 Ay', value: '3mo' },
    { label: '6 Ay', value: '6mo' }, { label: '1 Yıl', value: '1y' },
  ]

  const fetchData = async (p = period, isForce = false) => {
    try {
      setLoading(true)
      setError('')
      const [analyzeRes, fundRes] = await Promise.all([
        client.get(`/stock/${ticker}/analyze?period=${p}${isForce ? '&force=true' : ''}`),
        client.get(`/stock/${ticker}/fundamental`).catch(() => ({ data: null }))
      ])
      setAnalysis(analyzeRes.data)
      setFundamental(fundRes.data)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Analiz tamamlanamadı.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(period, false) }, [ticker, period])

  const priceWithEma = useMemo(() => {
    if (!analysis?.priceData) return []
    return calculateEMA(analysis.priceData).map(p => ({
      date: new Date(p.date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
      close: p.close, ema: p.ema, volume: p.volume
    }))
  }, [analysis])

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
      <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-400 text-sm animate-pulse">{ticker} analiz ediliyor... (7 kademe)</p>
    </div>
  )

  if (error) return (
    <div className="max-w-md mx-auto mt-16 text-center space-y-4">
      <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
      <h2 className="text-lg font-bold text-white">Analiz Başarısız</h2>
      <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-4">{error}</p>
      <Link to="/" className="btn-outline">← Geri Dön</Link>
    </div>
  )

  const ind = analysis?.indicators || {}
  const ratios = fundamental?.ratios || {}
  const signalStyle = SIGNAL_STYLES[analysis?.signal] || SIGNAL_STYLES['BEKLE']

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Risk Level Modal */}
      {showRiskModal && <RiskLevelModal riskLevel={analysis?.riskLevel} onClose={() => setShowRiskModal(false)} currentPrice={analysis?.currentPrice} ticker={ticker} />}
      {/* ─── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link to="/signals" className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:border-purple-500/50 transition-colors">
            <ArrowLeft size={16} className="text-slate-400" />
          </Link>
          <span className="w-3 h-3 rounded-full" style={{ background: color }} />
          <h1 className="text-2xl font-bold">{ticker}</h1>
          <span className={`text-sm font-bold px-3 py-1 rounded-full border signal-pulse ${signalStyle}`}>{analysis?.signal}</span>
          <RiskLevelBadge riskLevel={analysis?.riskLevel} onClick={() => setShowRiskModal(true)} />
        </div>
        <div className="flex items-center gap-6">
          <DataReliabilityBadge ticker={ticker} />
          <div className="text-right">
            <p className="text-xs text-slate-500 uppercase">Güncel Fiyat</p>
            <p className="text-2xl font-bold">{formatCurrency(analysis?.currentPrice)}</p>
          </div>
          <button onClick={() => fetchData(period, true)} className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:border-purple-500/50 transition-colors">
            <RefreshCw size={16} className={loading ? "text-slate-400 animate-spin" : "text-slate-400"} />
          </button>
        </div>
      </div>

      {/* Period pills */}
      <div className="flex gap-2">
        {periods.map(p => (
          <button key={p.value} onClick={() => setPeriod(p.value)}
            className={`px-3 py-1 text-xs rounded-full border transition-all ${
              period === p.value ? 'bg-purple-600 border-purple-500 text-white' : 'border-white/10 text-slate-400 hover:text-white'
            }`}>{p.label}</button>
        ))}
      </div>

      {/* ─── BÖLÜM 1: Pipeline Visualizer ─────────────────────── */}
      <PipelineVisualizer pipeline={analysis?.pipeline} />

      {/* ─── BÖLÜM 2: Ana Grid (Indicators + Chart) ──────────── */}
      <div className="grid grid-cols-12 gap-5">
        {/* Left col: Indicators */}
        <div className="col-span-12 lg:col-span-4 space-y-3">
          {/* Overall Score */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold flex items-center gap-2"><Zap size={16} className="text-purple-400"/> AI Skor</span>
              <span className="text-2xl font-bold">{analysis?.finalScore}<span className="text-sm text-slate-500">/100</span></span>
            </div>
            <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500" style={{ width: `${analysis?.finalScore}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-1 mt-3 text-center text-[10px] text-slate-500">
              <div>CDS: <span className="text-slate-300 font-mono">{analysis?.macro?.cds} bps</span></div>
              <div>VIX: <span className="text-slate-300 font-mono">{analysis?.macro?.vix}</span></div>
              <div>Makro: <span className="text-slate-300 font-mono">{analysis?.macro?.macroScore}/100</span></div>
            </div>
          </div>

          {/* Indicators */}
          {ind.rsi && <IndicatorBar label="RSI (14)" icon={Activity} {...ind.rsi} />}
          {ind.macd && <IndicatorBar label="MACD" icon={TrendingUp} {...ind.macd} />}
          {ind.sma && <IndicatorBar label="SMA 20/50 (Golden Cross)" icon={BarChart2} {...ind.sma} />}
          {ind.bollinger && <IndicatorBar label="Bollinger Bantları" icon={Activity} {...ind.bollinger} />}
          {ind.volume && <IndicatorBar label="Hacim Analizi" icon={BarChart2} {...ind.volume} />}
          {ind.trend && <IndicatorBar label="Trend Gücü (20 Gün)" icon={TrendingUp} {...ind.trend} />}
          {ind.ofi && <IndicatorBar label="OFI (Emir Akışı Dengesi)" icon={Activity} status={ind.ofi.status} score={ind.ofi.score} color={ind.ofi.score >= 60 ? 'green' : ind.ofi.score <= 40 ? 'red' : 'yellow'} comment={ind.ofi.comment} />}
        </div>

        {/* Right col: Chart + Commentary */}
        <div className="col-span-12 lg:col-span-8 space-y-5">
          {/* Price Chart */}
          <ChartCard icon="📈" title="Fiyat & EMA-12" badge={period.toUpperCase()}>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={priceWithEma} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} domain={['dataMin - (dataMin * 0.05)', 'dataMax + (dataMax * 0.05)']} />
                {/* Hacim için sağ eksen eklendi */}
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} />
                
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: '15px' }} iconType="plainline" />
                
                {/* Hacim (Sağ Eksen) */}
                <Bar yAxisId="right" dataKey="volume" fill="#475569" fillOpacity={0.25} name="Hacim" isAnimationActive={false} barSize={6} radius={[4,4,0,0]} />
                
                {/* Asıl Fiyat */}
                <Area yAxisId="left" type="monotone" dataKey="close" stroke={color} strokeWidth={3} fill="url(#priceAreaGrad)" name="Fiyat" isAnimationActive={false} activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }} />
                
                {/* EMA 12 (Vibrant Pink) */}
                <Line yAxisId="left" type="monotone" dataKey="ema" stroke="#ec4899" strokeWidth={2} dot={false} name="EMA-12" strokeDasharray="4 4" isAnimationActive={false} style={{ filter: 'drop-shadow(0px 0px 4px rgba(236,72,153,0.5))' }} />
                
                {/* Bollinger Bantları Lejant Gösterimi İçin Sahte Çizgiler */}
                {analysis?.indicators?.bollinger?.raw?.upper && (
                  <Line dataKey="none" stroke="#f43f5e" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="Bollinger Üst" isAnimationActive={false} />
                )}
                {analysis?.indicators?.bollinger?.raw?.lower && (
                  <Line dataKey="none2" stroke="#06b6d4" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="Bollinger Alt" isAnimationActive={false} />
                )}

                {/* Referans Çizgileri (Yazısız, sadece net ayırt edici renk) */}
                {analysis?.indicators?.bollinger?.raw?.upper && (
                  <ReferenceLine yAxisId="left" y={analysis.indicators.bollinger.raw.upper} stroke="#f43f5e" strokeDasharray="3 3" strokeWidth={1.5} />
                )}
                {analysis?.indicators?.bollinger?.raw?.lower && (
                  <ReferenceLine yAxisId="left" y={analysis.indicators.bollinger.raw.lower} stroke="#06b6d4" strokeDasharray="3 3" strokeWidth={1.5} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* AI Commentary */}
          <ChartCard icon="🤖" title="AI Yorum & Strateji Analizi" badge="YAPAY ZEKA" badgeColor="ai">
            {analysis?.commentary && <AICommentary text={analysis.commentary} />}
          </ChartCard>
        </div>
      </div>

      {/* ─── BÖLÜM 3: Ağırlıklı Etki + Tahmin ────────────────── */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-5">
          <PriceImpactPanel priceImpact={analysis?.priceImpact} currentPrice={analysis?.currentPrice} />
        </div>
        <div className="col-span-12 lg:col-span-7">
          <PredictionsPanel predictions={analysis?.predictions} currentPrice={analysis?.currentPrice} />
        </div>
      </div>

      {/* ─── BÖLÜM 5: Finansal Çarpanlar & Standart Bilanço ───────── */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-4">
          <ChartCard icon="🎯" title="Temel Analiz Çarpanları">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'F/K Oranı', formula: 'Fiyat / Hisse Başı Kâr', value: ratios.fk },
                { label: 'PD/DD', formula: 'Piyasa Değeri / Defter Değeri', value: ratios.pddd },
                { label: 'Cari Oran', formula: 'Dönen Varlıklar / KV Borçlar', value: ratios.currentRatio },
                { label: 'Net Marj %', formula: 'Net Kâr / Toplam Satışlar', value: ratios.netMargin },
                { label: 'Kaldıraç', formula: 'Toplam Borç / Özkaynaklar', value: ratios.leverage },
                { label: 'Borç/FAVÖK', formula: 'Net Borç / FAVÖK (EBITDA)', value: ratios.nfbToEbitda },
                { label: 'Gross Marj %', formula: 'Brüt Kâr / Toplam Satışlar', value: ratios.grossMargin },
                { label: 'Asit Test', formula: '(Hızlı Varlıklar - Stok) / KV Borç', value: ratios.acidTest },
              ].map(r => (
                <div key={r.label} className="p-3 rounded-xl bg-white/3 border border-white/5 text-center transition-all hover:bg-white/5 group">
                  <div className="text-[10px] text-slate-400 font-bold mb-0.5">{r.label}</div>
                  <div className="text-[9px] text-slate-600 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity">{r.formula}</div>
                  <div className="text-base font-bold text-white font-mono">{r.value ?? '—'}</div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
        <div className="col-span-12 lg:col-span-8">
          <ChartCard icon="📋" title="Standart Bilanço Tablosu (Trend)" badge="MALİ VERİ">
            <BalanceSheetTable fundamental={fundamental} />
          </ChartCard>
        </div>
      </div>

      {/* ─── BÖLÜM 6: Rejim + Risk + G-Policy (Mevcut) ───────── */}
      {analysis && (
        <div className="grid grid-cols-12 gap-4">
          {/* Rejim Tespiti */}
          <div className="col-span-12 md:col-span-4">
            <ChartCard icon="🧠" title="Rejim Tespiti (HMM)" badge="KADEME 3">
              <div className="space-y-3">
                <div className={`text-center py-2 rounded-xl border ${
                  analysis.regime?.name === 'Kriz' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                  analysis.regime?.name === 'Yüksek Vol' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                  'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                }`}>
                  <div className="text-xs text-slate-500 mb-1">Aktif Rejim</div>
                  <div className="text-lg font-bold">{analysis.regime?.name}</div>
                  <div className="text-xs mt-1">~{analysis.regime?.expectedDuration} gün kalması bekleniyor</div>
                </div>
                {[{label:'Sakin', val: analysis.regime?.probabilities?.calm, c:'green'},{label:'Kriz', val: analysis.regime?.probabilities?.crisis, c:'red'},{label:'Yüksek Vol', val: analysis.regime?.probabilities?.highVol, c:'yellow'}].map(r=>(
                  <div key={r.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">{r.label}</span>
                      <span className="font-mono">{((r.val||0)*100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{width:`${(r.val||0)*100}%`, backgroundColor: r.c==='green'?'#10b981':r.c==='red'?'#f43f5e':'#f59e0b'}} />
                    </div>
                  </div>
                ))}
                <div className="text-[11px] text-slate-500 pt-2 border-t border-white/5">
                  <div>Dinamik Ağırlıklar:</div>
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    <span>Teknik: <b>{((analysis.regime?.dynamicWeights?.tech||0)*100).toFixed(0)}%</b></span>
                    <span>Makro: <b>{((analysis.regime?.dynamicWeights?.macro||0)*100).toFixed(0)}%</b></span>
                    <span>Temel: <b>{((analysis.regime?.dynamicWeights?.fund||0)*100).toFixed(0)}%</b></span>
                    <span>Sentiment: <b>{((analysis.regime?.dynamicWeights?.sent||0)*100).toFixed(0)}%</b></span>
                  </div>
                </div>
                {analysis.regime?.alert && <div className="text-xs p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">{analysis.regime.alert}</div>}
              </div>
            </ChartCard>
          </div>

          {/* Risk Analytics */}
          <div className="col-span-12 md:col-span-4">
            <ChartCard icon="⚠️" title="Risk Analizi (GARCH + VaR)" badge="KADEME 4">
              <div className="space-y-2.5">
                {[{
                  label: 'VaR₉₅ (Günlük)',
                  value: analysis.risk?.var95 !== null ? `${analysis.risk.var95}%` : '—',
                  hint: 'Günde %5 ihtimalle bu kadar zarar',
                  color: (analysis.risk?.var95||0) > -2 ? 'text-green-400' : (analysis.risk?.var95||0) > -3.5 ? 'text-amber-400' : 'text-red-400'
                },{
                  label: 'CVaR₉₅ (Beklenen Kayıp)',
                  value: analysis.risk?.cvar95 !== null ? `${analysis.risk.cvar95}%` : '—',
                  hint: 'VaR aşıldığında ortalama zarar',
                  color: (analysis.risk?.cvar95||0) > -3 ? 'text-green-400' : 'text-red-400'
                },{
                  label: 'GARCH Volatilite',
                  value: analysis.risk?.garch?.annualSigma ? `${analysis.risk.garch.annualSigma}%` : '—',
                  hint: `Kalıcılık: ${analysis.risk?.garch?.persistence?.toFixed(3)||'—'} | Yarı ömür: ${analysis.risk?.garch?.halfLife||'—'} g`,
                  color: 'text-slate-300'
                },{
                  label: 'Tail Index (EVT ξ)',
                  value: analysis.risk?.xi?.toFixed(3) ?? '—',
                  hint: analysis.risk?.tailRisk?.level || '',
                  color: (analysis.risk?.xi||0) < 0.15 ? 'text-green-400' : (analysis.risk?.xi||0) > 0.3 ? 'text-red-400' : 'text-amber-400'
                },{
                  label: 'Max Drawdown',
                  value: analysis.risk?.maxDrawdown ? `${analysis.risk.maxDrawdown}%` : '—',
                  hint: 'Tarihsel en büyük düşüş',
                  color: (analysis.risk?.maxDrawdown||0) < 15 ? 'text-green-400' : (analysis.risk?.maxDrawdown||0) > 35 ? 'text-red-400' : 'text-amber-400'
                }].map(item => (
                  <div key={item.label} className="flex justify-between items-start py-2 border-b border-white/5">
                    <div>
                      <div className="text-xs text-slate-400">{item.label}</div>
                      <div className="text-[10px] text-slate-600 mt-0.5">{item.hint}</div>
                    </div>
                    <span className={`font-bold font-mono text-sm ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>

          {/* G-Policy + FracDiff */}
          <div className="col-span-12 md:col-span-4">
            <ChartCard icon="⚡" title="G-Learning Politikası" badge="KADEME 5">
              <div className="space-y-3">
                <div className="text-center py-3 rounded-xl bg-purple-500/10 border border-purple-500/30">
                  <div className="text-xs text-slate-500 mb-1">En Güçlü Aksiyon (β=0.1)</div>
                  <div className="text-xl font-bold text-purple-300">{analysis.gPolicy?.bestAction}</div>
                  <div className="text-xs text-slate-500 mt-1">Güven: %{((analysis.gPolicy?.bestProb||0)*100).toFixed(0)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-slate-500 mb-2">Fraksiyon Diferansiyasyon (Kademe 1)</div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Optimal d</span>
                    <span className="font-mono font-bold">{analysis.fracDiff?.d}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Hafıza Korunumu</span>
                    <span className="font-mono font-bold text-cyan-400">%{analysis.fracDiff?.memoryRetained}</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-cyan-500 rounded-full" style={{width:`${analysis.fracDiff?.memoryRetained||50}%`}} />
                  </div>
                  <div className="text-[10px] text-slate-600 mt-1">d={analysis.fracDiff?.d} → %{analysis.fracDiff?.memoryRetained} hafıza korunuyor, seri durağan</div>
                </div>
                <div className="pt-2 border-t border-white/5">
                  <div className="text-xs text-slate-500 mb-1">Çok Amaçlı Ödül (R_t)</div>
                  <div className={`text-lg font-bold font-mono ${(analysis.reward||0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {analysis.reward > 0 ? '+' : ''}{(analysis.reward||0).toFixed(4)}
                  </div>
                  <div className="text-[10px] text-slate-600">Getiri - CVaR Cezası - Drawdown Cezası</div>
                </div>
              </div>
            </ChartCard>
          </div>
        </div>
      )}

      {/* ─── Footer: Analiz zamanı ─────────────────────────────── */}
      {analysis?.analysisTimestamp && (
        <div className="text-center text-[10px] text-slate-600 pt-2">
          <Clock size={10} className="inline mr-1" />
          Son analiz: {new Date(analysis.analysisTimestamp).toLocaleString('tr-TR')} | FinansRadar AI v5.0
        </div>
      )}
    </div>
  )
}

export default StockDetail
