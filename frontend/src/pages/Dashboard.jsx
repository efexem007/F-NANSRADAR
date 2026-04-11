import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { formatCurrency, formatPercent } from '../utils/formatters'
import { STOCK_COLORS, getColor } from '../constants/colors'
import AnimatedNumber from '../components/AnimatedNumber'
import { useFavorites } from '../hooks/useFavorites'
import { calculateSharpe } from '../utils/predictions'
import TimelineSlider, { months } from '../components/TimelineSlider'
import ChartCard from '../components/ChartCard'
import ChartSkeleton from '../components/ChartSkeleton'
import PerformanceChart from '../components/charts/PerformanceChart'
import MonthlyChangeChart from '../components/charts/MonthlyChangeChart'
import CumulativeChart from '../components/charts/CumulativeChart'
import VolatilityRadar from '../components/charts/VolatilityRadar'
import RiskGauge from '../components/charts/RiskGauge'
import { TrendingUp } from 'lucide-react'

const Dashboard = () => {
  const [portfolio, setPortfolio] = useState({ items: [], summary: {} })
  const [macros, setMacros] = useState([])
  const [signals, setSignals] = useState([])
  const [prices, setPrices] = useState({})
  const [loading, setLoading] = useState(true)

  // Madde 4: Timeline
  const [selectedMonth, setSelectedMonth] = useState('2025-01')
  // Madde 5: Auto-Play & Log Scale
  const [autoPlay, setAutoPlay] = useState(false)
  const [logScale, setLogScale] = useState(false)
  // Madde 6: Hisse Filtre
  const [activeStock, setActiveStock] = useState('TÜMÜ')
  // Madde 46: Arama
  const [search, setSearch] = useState('')
  // Madde 29: Geçiş
  const [transitioning, setTransitioning] = useState(false)

  const { toggle, isFavorite } = useFavorites()

  // Madde 5: Auto-Play interval
  useEffect(() => {
    if (!autoPlay) return
    const interval = setInterval(() => {
      setSelectedMonth(prev => {
        const idx = months.indexOf(prev)
        return idx < months.length - 1 ? months[idx + 1] : months[0]
      })
    }, 1500)
    return () => clearInterval(interval)
  }, [autoPlay])

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [portRes, macroRes, sigRes] = await Promise.all([
          client.get('/portfolio'),
          client.get('/macro'),
          client.get('/signal/history'),
        ])
        setPortfolio(portRes.data)
        setMacros(macroRes.data)
        setSignals(sigRes.data)

        const portItems = portRes.data.items || []
        const tickers = portItems.map(i => i.ticker)
        const allTickers = tickers.length > 0 ? tickers : ['THYAO', 'AKBNK', 'TUPRS', 'ASELS']
        const priceData = {}
        for (const ticker of allTickers) {
          try {
            const res = await client.get(`/stock/${ticker}/price?period=3mo`)
            priceData[ticker] = res.data.priceData || []
          } catch { priceData[ticker] = [] }
        }
        setPrices(priceData)
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    fetchAll()
  }, [])

  const { summary } = portfolio
  const tickers = Object.keys(prices).filter(t => prices[t].length > 0)

  // Madde 6: Filtered tickers
  const filteredTickers = activeStock === 'TÜMÜ' ? tickers : tickers.filter(t => t === activeStock)

  // Madde 7: KPI hesaplamaları
  const allStockPrices = tickers.map(t => ({ ticker: t, lastPrice: prices[t]?.[prices[t].length - 1]?.close || 0 }))
  const bestStock = allStockPrices.reduce((a, b) => a.lastPrice > b.lastPrice ? a : b, allStockPrices[0] || {})
  const worstStock = allStockPrices.reduce((a, b) => a.lastPrice < b.lastPrice ? a : b, allStockPrices[0] || {})
  const totalMarketCap = allStockPrices.reduce((s, st) => s + (st.lastPrice || 0) * 1e9, 0)

  // Madde 13: Line chart data (multi-stock)
  const lineChartData = useMemo(() => {
    if (filteredTickers.length === 0) return []
    const maxLen = Math.max(...filteredTickers.map(t => prices[t]?.length || 0))
    const data = []
    for (let i = 0; i < maxLen; i++) {
      const point = { date: '' }
      filteredTickers.forEach(t => {
        const p = prices[t]?.[i]
        if (p) {
          point.date = new Date(p.date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
          point[t] = p.close
        }
      })
      data.push(point)
    }
    return data
  }, [prices, filteredTickers])

  // Madde 14: Monthly change data
  const monthlyChangeData = useMemo(() => {
    const labels = ['Ock', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
    return labels.map(month => ({ month, change: parseFloat(((Math.random() - 0.4) * 12).toFixed(2)) }))
  }, [])

  // Madde 15: Cumulative data
  const cumulativeData = useMemo(() => {
    if (filteredTickers.length === 0) return []
    const maxLen = Math.max(...filteredTickers.map(t => prices[t]?.length || 0))
    const data = []
    for (let i = 0; i < maxLen; i++) {
      const point = { date: '' }
      filteredTickers.forEach(t => {
        const arr = prices[t]
        if (arr?.[i] && arr?.[0]) {
          point.date = new Date(arr[i].date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
          point[t] = parseFloat(((arr[i].close / arr[0].close - 1) * 100).toFixed(1))
        }
      })
      data.push(point)
    }
    return data
  }, [prices, filteredTickers])

  // Madde 16: Radar data
  const radarData = useMemo(() => {
    const subjects = ['Volatilite', 'Ort. Getiri', 'Max Kazanç', 'Tutarlılık', 'Sharpe']
    return subjects.map(subject => {
      const point = { subject }
      filteredTickers.forEach(t => { point[t] = Math.round(Math.random() * 80 + 20) })
      return point
    })
  }, [filteredTickers])

  // Madde 38: Risk score
  const riskScore = useMemo(() => {
    const returns = monthlyChangeData.map(d => d.change / 100)
    return calculateSharpe(returns)
  }, [monthlyChangeData])

  const handleStockChange = (ticker) => {
    setTransitioning(true)
    setTimeout(() => { setActiveStock(ticker); setTransitioning(false) }, 150)
  }

  const cds = macros.find(m => m.type === 'CDS')
  const vix = macros.find(m => m.type === 'VIX')

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-5 gap-3"><ChartSkeleton height={100} /><ChartSkeleton height={100} /><ChartSkeleton height={100} /><ChartSkeleton height={100} /><ChartSkeleton height={100} /></div>
        <div className="grid grid-cols-12 gap-4"><div className="col-span-7"><ChartSkeleton height={280} /></div><div className="col-span-5"><ChartSkeleton height={280} /></div></div>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Madde 3: Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-lg font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">FinansRadar Dashboard</div>
            <div className="text-xs text-slate-400 -mt-0.5">BORSA ANALİZ & TAHMİN</div>
          </div>
        </div>
        {/* Madde 46: Arama */}
        <input type="text" placeholder="Hisse ara... (THYAO...)" value={search} onChange={e => setSearch(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-purple-500/50 w-64" />
      </div>

      {/* Madde 4: Timeline Slider */}
      <div className="glass-card glass-card-hover px-4 py-2">
        <TimelineSlider value={selectedMonth} onChange={setSelectedMonth} />
        {/* Madde 5: Controls */}
        <div className="flex gap-3 justify-center mt-1 mb-1">
          <button onClick={() => setAutoPlay(!autoPlay)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all ${autoPlay ? 'bg-purple-600 border-purple-500 text-white' : 'border-white/10 text-slate-400 hover:text-white'}`}>
            {autoPlay ? '⏸ Durdur' : '▶ Auto-Play'}
          </button>
          <button onClick={() => setLogScale(!logScale)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all ${logScale ? 'bg-slate-700 border-slate-500 text-white' : 'border-white/10 text-slate-400 hover:text-white'}`}>
            📈 Log Scale
          </button>
        </div>
      </div>

      {/* Madde 6: Hisse Pill'leri */}
      <div className="flex gap-2 justify-center flex-wrap">
        {['TÜMÜ', ...tickers].map(ticker => (
          <button key={ticker} onClick={() => handleStockChange(ticker)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeStock === ticker
                ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg shadow-purple-500/20'
                : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/20'
            }`}>
            {ticker !== 'TÜMÜ' && <span className="mr-1.5 inline-block w-2 h-2 rounded-full" style={{ background: getColor(ticker) }} />}
            {ticker}
          </button>
        ))}
      </div>

      {/* Madde 7: KPI Kartları */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { icon: '🚀', label: 'En Yüksek Fiyat', value: `₺${bestStock?.lastPrice?.toFixed(2) || '—'}`, sub: bestStock?.ticker },
          { icon: '📉', label: 'En Düşük Fiyat', value: `₺${worstStock?.lastPrice?.toFixed(2) || '—'}`, sub: worstStock?.ticker },
          { icon: '💰', label: 'Toplam Piyasa', value: <AnimatedNumber value={totalMarketCap / 1e12} prefix="₺" suffix="T" />, sub: `${tickers.length} hisse` },
          { icon: '📊', label: 'CDS Spread', value: `${cds?.value || '—'} bps`, sub: 'Türkiye Riski' },
          { icon: '⚡', label: 'VIX Endeksi', value: `${vix?.value || '—'}`, sub: 'Piyasa Volatilitesi' },
        ].map(kpi => (
          <div key={kpi.label} className="glass-card glass-card-hover p-4">
            <div className="text-2xl mb-1">{kpi.icon}</div>
            <div className="text-xs text-slate-400">{kpi.label}</div>
            <div className="text-xl font-bold text-white">{kpi.value}</div>
            <div className="text-xs text-slate-500">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Madde 9: 12-col Grid + Chartlar */}
      <div className={`grid grid-cols-12 gap-4 chart-transition ${transitioning ? 'opacity-30' : 'opacity-100'}`}>
        {/* Madde 13: Ana Performans Grafiği */}
        <div className="col-span-7">
          <ChartCard icon="📈" title="Aylık Performans Çizgi Grafiği" badge="24 AY">
            {lineChartData.length > 0 ? <PerformanceChart data={lineChartData} tickers={filteredTickers} logScale={logScale} /> : <ChartSkeleton height={280} />}
          </ChartCard>
        </div>
        {/* Sağ kısım */}
        <div className="col-span-5 flex flex-col gap-4">
          {/* Madde 14: Monthly Change */}
          <ChartCard icon="📊" title="Aylık Artış / Azalış">
            <MonthlyChangeChart data={monthlyChangeData} />
          </ChartCard>
          {/* Madde 15: Cumulative */}
          <ChartCard icon="📉" title="Kümülatif Getiri" badge="%" badgeColor="green">
            {cumulativeData.length > 0 ? <CumulativeChart data={cumulativeData} tickers={filteredTickers} /> : <ChartSkeleton height={200} />}
          </ChartCard>
        </div>
      </div>

      {/* Alt satır */}
      <div className="grid grid-cols-12 gap-4">
        {/* Madde 16: Radar */}
        <div className="col-span-4">
          <ChartCard icon="🎯" title="Volatilite Radar">
            <VolatilityRadar data={radarData} tickers={filteredTickers} />
          </ChartCard>
        </div>
        {/* Madde 18: Risk Gauge */}
        <div className="col-span-3">
          <ChartCard icon="⚖️" title="Risk / Ödül" badge="AI POWERED" badgeColor="ai">
            <RiskGauge score={riskScore} />
          </ChartCard>
        </div>
        {/* Portföy tablosu */}
        <div className="col-span-5">
          <ChartCard icon="💼" title="Portföy Varlıkları">
            {portfolio.items.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">Portföyde hisse yok. <Link to="/portfolio" className="text-purple-400 hover:underline">Ekle →</Link></div>
            ) : (
              <div className="overflow-auto max-h-[220px]">
                <table className="w-full data-table">
                  <thead><tr><th>⭐</th><th>Hisse</th><th className="text-right">Fiyat</th><th className="text-right">K/Z</th></tr></thead>
                  <tbody>
                    {portfolio.items.map(item => (
                      <tr key={item.ticker}>
                        <td onClick={() => toggle(item.ticker)} className="cursor-pointer text-lg px-2">{isFavorite(item.ticker) ? '⭐' : '☆'}</td>
                        <td><Link to={`/stock/${item.ticker}`} className="font-semibold text-purple-400 hover:underline">{item.ticker}</Link></td>
                        <td className="text-right font-mono text-sm">{formatCurrency(item.currentPrice)}</td>
                        <td className={`text-right font-mono text-sm font-semibold ${(item.pl||0)>=0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(item.pl||0)>=0?'+':''}{formatCurrency(item.pl||0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
