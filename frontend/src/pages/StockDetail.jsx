import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar } from 'recharts'
import client from '../api/client'
import { formatCurrency, formatNumber } from '../utils/formatters'
import { getColor } from '../constants/colors'
import { linearRegression, calculateEMA } from '../utils/predictions'
import ChartCard from '../components/ChartCard'
import ChartTooltip from '../components/ChartTooltip'
import RiskGauge from '../components/charts/RiskGauge'
import { Activity, ArrowLeft } from 'lucide-react'

const StockDetail = () => {
  const { ticker } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('3mo')
  const color = getColor(ticker)

  // Madde 44: multi-period
  const periods = [
    { label: '1 Ay', value: '1mo' }, { label: '3 Ay', value: '3mo' },
    { label: '6 Ay', value: '6mo' }, { label: '1 Yıl', value: '1y' },
  ]

  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        const [fundRes, priceRes] = await Promise.all([
          client.get(`/stock/${ticker}/fundamental`),
          client.get(`/stock/${ticker}/price?period=${period}`)
        ])
        setData({ fund: fundRes.data, price: priceRes.data })
      } catch { setError('Hisse verileri yüklenemedi.') }
      finally { setLoading(false) }
    })()
  }, [ticker, period])

  // Madde 37: EMA
  const priceWithEma = useMemo(() => {
    if (!data?.price?.priceData) return []
    return calculateEMA(data.price.priceData).map(p => ({
      date: new Date(p.date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
      close: p.close, ema: p.ema, volume: p.volume
    }))
  }, [data])

  // Madde 36: Prediction
  const predictions = useMemo(() => {
    if (!data?.price?.priceData) return []
    return linearRegression(data.price.priceData)
  }, [data])

  // Madde 19: Combined chart data (actual + predicted)
  const predictionChartData = useMemo(() => {
    const actual = priceWithEma.map(p => ({ ...p, predicted: null }))
    const lastPrice = actual[actual.length - 1]?.close || 0
    const preds = predictions.map(p => ({ date: p.date, close: null, ema: null, predicted: p.predicted, volume: 0 }))
    return [...actual, ...preds]
  }, [priceWithEma, predictions])

  if (loading && !data) return <div className="flex items-center justify-center h-[60vh]"><div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>
  if (error) return <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-lg">{error}</div>
  if (!data?.fund) return <div className="text-center py-20 text-slate-500">Kayıt bulunamadı</div>

  const { fund, price } = data
  const ratios = fund.ratios || {}

  const RatioRow = ({ label, value }) => (
    <div className="flex justify-between py-2 border-b border-white/5 text-sm">
      <span className="text-slate-500">{label}</span><span className="font-semibold font-mono">{value ?? '—'}</span>
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/portfolio" className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:border-purple-500/50 transition-colors">
            <ArrowLeft size={16} className="text-slate-400" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: color }} />
            <h1 className="text-2xl font-bold">{ticker}</h1>
            <span className="text-slate-500 text-sm">Analizi</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 uppercase">Güncel Fiyat</p>
          <p className="text-3xl font-bold">{formatCurrency(price.currentPrice)}</p>
        </div>
      </div>

      {/* Madde 44: Period pills */}
      <div className="flex gap-2">
        {periods.map(p => (
          <button key={p.value} onClick={() => setPeriod(p.value)}
            className={`px-3 py-1 text-xs rounded-full border transition-all ${
              period === p.value ? 'bg-purple-600 border-purple-500 text-white' : 'border-white/10 text-slate-400 hover:text-white'
            }`}>{p.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Madde 17: Volume + Price Combo */}
        <div className="col-span-8">
          <ChartCard icon="📈" title="Fiyat & Hacim" badge={period.toUpperCase()}>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={priceWithEma} syncId="finansradar">
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} />
                <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="right" dataKey="volume" fill={color} fillOpacity={0.2} animationDuration={800} name="Hacim" />
                <Line yAxisId="left" type="monotone" dataKey="close" stroke={color} strokeWidth={2} dot={false} animationDuration={1500} name="Fiyat" />
                <Line yAxisId="left" type="monotone" dataKey="ema" stroke="#ec4899" strokeWidth={1.5} dot={false} animationDuration={1500} name="EMA-12" strokeDasharray="4 2" />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Ratios */}
        <div className="col-span-4 space-y-4">
          <ChartCard icon="🎯" title="Finansal Çarpanlar">
            <RatioRow label="F/K" value={ratios.fk} />
            <RatioRow label="PD/DD" value={ratios.pddd} />
            <RatioRow label="Cari Oran" value={ratios.currentRatio} />
            <RatioRow label="Net Marj" value={ratios.netMargin} />
            <RatioRow label="Kaldıraç" value={ratios.leverage} />
            <RatioRow label="Borç/FAVÖK" value={ratios.nfbToEbitda} />
          </ChartCard>
          <ChartCard icon="⚖️" title="Risk Skoru" badge="AI" badgeColor="ai">
            <RiskGauge score={65} />
          </ChartCard>
        </div>
      </div>

      {/* Madde 19: Tahmin Grafiği */}
      <ChartCard icon="🤖" title="Tahmin Modeli" badge="AI POWERED" badgeColor="ai">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={predictionChartData}>
            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line dataKey="close" stroke="#00ff88" strokeWidth={2} dot={false} name="Gerçek" animationDuration={1500} />
            <Line dataKey="predicted" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Tahmin" animationDuration={1500} />
            <Line dataKey="ema" stroke="#ec4899" strokeWidth={1.5} dot={false} name="EMA" animationDuration={1500} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

export default StockDetail
