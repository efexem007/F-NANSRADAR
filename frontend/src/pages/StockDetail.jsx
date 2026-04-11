import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, ReferenceLine } from 'recharts'
import client from '../api/client'
import { formatCurrency } from '../utils/formatters'
import { getColor } from '../constants/colors'
import { linearRegression, calculateEMA } from '../utils/predictions'
import ChartCard from '../components/ChartCard'
import ChartTooltip from '../components/ChartTooltip'
import { ArrowLeft, RefreshCw, Activity, TrendingUp, TrendingDown, AlertTriangle, BarChart2, Zap } from 'lucide-react'

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

function AICommentary({ text, signal, score }) {
  const lines = text.split('\n').filter(Boolean)
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const isBold = line.startsWith('**') || line.startsWith('📈') || line.startsWith('✅') || line.startsWith('⚠️') || line.startsWith('📉') || line.startsWith('⏸')
        const clean = line.replace(/\*\*/g, '').replace(/_/g, '')
        return (
          <p key={i} className={`text-sm leading-relaxed ${isBold ? 'text-white font-semibold' : 'text-slate-400'}`}>
            {clean}
          </p>
        )
      })}
    </div>
  )
}

const StockDetail = () => {
  const { ticker } = useParams()
  const [analysis, setAnalysis] = useState(null)
  const [fundamental, setFundamental] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('3mo')
  const color = getColor(ticker)

  const periods = [
    { label: '1 Ay', value: '1mo' }, { label: '3 Ay', value: '3mo' },
    { label: '6 Ay', value: '6mo' }, { label: '1 Yıl', value: '1y' },
  ]

  const fetchData = async (p = period) => {
    try {
      setLoading(true)
      setError('')
      const [analyzeRes, fundRes] = await Promise.all([
        client.get(`/stock/${ticker}/analyze?period=${p}`),
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

  useEffect(() => { fetchData(period) }, [ticker, period])

  const priceWithEma = useMemo(() => {
    if (!analysis?.priceData) return []
    return calculateEMA(analysis.priceData).map(p => ({
      date: new Date(p.date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
      close: p.close, ema: p.ema, volume: p.volume
    }))
  }, [analysis])

  const predictions = useMemo(() => {
    if (!analysis?.priceData) return []
    return linearRegression(analysis.priceData)
  }, [analysis])

  const chartData = useMemo(() => {
    const actual = priceWithEma.map(p => ({ ...p, predicted: null }))
    const preds = predictions.map(p => ({ date: p.date, close: null, ema: null, predicted: p.predicted, volume: 0 }))
    return [...actual, ...preds]
  }, [priceWithEma, predictions])

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
      <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-400 text-sm animate-pulse">{ticker} analiz ediliyor...</p>
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

  const RatioRow = ({ label, value }) => (
    <div className="flex justify-between py-2 border-b border-white/5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold font-mono">{value ?? '—'}</span>
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link to="/signals" className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:border-purple-500/50 transition-colors">
            <ArrowLeft size={16} className="text-slate-400" />
          </Link>
          <span className="w-3 h-3 rounded-full" style={{ background: color }} />
          <h1 className="text-2xl font-bold">{ticker}</h1>
          <span className={`text-sm font-bold px-3 py-1 rounded-full border ${signalStyle}`}>{analysis?.signal}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-500 uppercase">Güncel Fiyat</p>
            <p className="text-2xl font-bold">{formatCurrency(analysis?.currentPrice)}</p>
          </div>
          <button onClick={() => fetchData(period)} className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:border-purple-500/50 transition-colors">
            <RefreshCw size={16} className="text-slate-400" />
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

      {/* Main grid */}
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
        </div>

        {/* Right col: Chart + Commentary */}
        <div className="col-span-12 lg:col-span-8 space-y-5">
          {/* Price Chart */}
          <ChartCard icon="📈" title="Fiyat & EMA-12" badge={period.toUpperCase()}>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={priceWithEma}>
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} />
                <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="right" dataKey="volume" fill={color} fillOpacity={0.15} name="Hacim" isAnimationActive={false} />
                <Line yAxisId="left" type="monotone" dataKey="close" stroke={color} strokeWidth={2} dot={false} name="Fiyat" isAnimationActive={false} />
                <Line yAxisId="left" type="monotone" dataKey="ema" stroke="#ec4899" strokeWidth={1.5} dot={false} name="EMA-12" strokeDasharray="4 2" isAnimationActive={false} />
                {analysis?.indicators?.bollinger?.raw?.upper && (
                  <ReferenceLine yAxisId="left" y={analysis.indicators.bollinger.raw.upper} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} label={{ value: 'BB Üst', fill: '#f59e0b', fontSize: 9 }} />
                )}
                {analysis?.indicators?.bollinger?.raw?.lower && (
                  <ReferenceLine yAxisId="left" y={analysis.indicators.bollinger.raw.lower} stroke="#10b981" strokeDasharray="3 3" strokeWidth={1} label={{ value: 'BB Alt', fill: '#10b981', fontSize: 9 }} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* AI Commentary */}
          <ChartCard icon="🤖" title="AI Yorum & Strateji Analizi" badge="YAPAY ZEKA" badgeColor="ai">
            {analysis?.commentary && <AICommentary text={analysis.commentary} signal={analysis.signal} score={analysis.finalScore} />}
          </ChartCard>

          {/* Tahmin */}
          <ChartCard icon="🔮" title="Tahmin Modeli (Lineer Regresyon)" badge="AI POWERED" badgeColor="ai">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line dataKey="close" stroke="#00ff88" strokeWidth={2} dot={false} name="Gerçek" isAnimationActive={false} />
                <Line dataKey="predicted" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Tahmin" isAnimationActive={false} />
                <Line dataKey="ema" stroke="#ec4899" strokeWidth={1.5} dot={false} name="EMA" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* Fundamental Ratios (if available) */}
      {fundamental?.ratios && Object.keys(ratios).length > 0 && (
        <ChartCard icon="🎯" title="Finansal Çarpanlar (Temel Analiz)">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'F/K Oranı', value: ratios.fk },
              { label: 'PD/DD', value: ratios.pddd },
              { label: 'Cari Oran', value: ratios.currentRatio },
              { label: 'Net Marj %', value: ratios.netMargin },
              { label: 'Kaldıraç', value: ratios.leverage },
              { label: 'Borç/FAVÖK', value: ratios.nfbToEbitda },
              { label: 'Gross Marj %', value: ratios.grossMargin },
              { label: 'Asit Test', value: ratios.acidTest },
            ].map(r => (
              <div key={r.label} className="p-3 rounded-xl bg-white/3 border border-white/5 text-center">
                <div className="text-[11px] text-slate-500 mb-1">{r.label}</div>
                <div className="text-lg font-bold text-white font-mono">{r.value ?? '—'}</div>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  )
}

export default StockDetail
