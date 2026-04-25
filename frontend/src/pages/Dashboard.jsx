import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { formatCurrency } from '../utils/formatters'
import { getColor } from '../constants/colors'
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
import { TrendingUp, Activity, BarChart3, Zap, TrendingDown, ArrowUpRight, ArrowDownRight, Globe, LayoutDashboard, Star, Radar, Wallet } from 'lucide-react'
import { motion } from 'framer-motion'

const Dashboard = () => {
  const [portfolio, setPortfolio] = useState({ items: [], summary: {} })
  const [macros, setMacros] = useState([])
  const [signals, setSignals] = useState([])
  const [prices, setPrices] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('2025-01')
  const [autoPlay, setAutoPlay] = useState(false)
  const [logScale, setLogScale] = useState(false)
  const [activeStock, setActiveStock] = useState('TÜMÜ')
  const [search, setSearch] = useState('')
  const [transitioning, setTransitioning] = useState(false)
  const [macroCountry, setMacroCountry] = useState('TR')
  const [allStocksForCompare, setAllStocksForCompare] = useState([])

  const { toggle, isFavorite } = useFavorites()

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

  useEffect(() => {
    client.get('/stock/list?pageSize=500&sortBy=ticker').then(res => {
      const stocks = res.data?.data || (Array.isArray(res.data) ? res.data : (res.data?.stocks || res.data?.items || []))
      setAllStocksForCompare(stocks)
    }).catch(() => {})
  }, [])

  const tickers = Object.keys(prices).filter(t => prices[t].length > 0)
  const filteredTickers = activeStock === 'TÜMÜ' ? tickers : tickers.filter(t => t === activeStock)

  const allStockPrices = tickers.map(t => ({ ticker: t, lastPrice: prices[t]?.[prices[t].length - 1]?.close || 0 }))
  const bestStock = allStockPrices.reduce((a, b) => a.lastPrice > b.lastPrice ? a : b, allStockPrices[0] || {})
  const worstStock = allStockPrices.reduce((a, b) => a.lastPrice < b.lastPrice ? a : b, allStockPrices[0] || {})
  const totalMarketCap = allStockPrices.reduce((s, st) => s + (st.lastPrice || 0) * 1e9, 0)

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

  const monthlyChangeData = useMemo(() => {
    const labels = ['Ock', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
    if (filteredTickers.length === 0) return labels.map(month => ({ month, change: 0 }))
    const monthlyChanges = labels.map((_, monthIdx) => {
      let totalChange = 0
      let count = 0
      filteredTickers.forEach(t => {
        const arr = prices[t]
        if (!arr || arr.length < 2) return
        const year = new Date().getFullYear()
        const monthStart = new Date(year, monthIdx, 1).getTime()
        const monthEnd = new Date(year, monthIdx + 1, 0).getTime()
        const monthPrices = arr.filter(p => {
          const d = new Date(p.date).getTime()
          return d >= monthStart && d <= monthEnd
        })
        if (monthPrices.length >= 2) {
          const firstPrice = monthPrices[0].close
          const lastPrice = monthPrices[monthPrices.length - 1].close
          totalChange += ((lastPrice - firstPrice) / firstPrice) * 100
          count++
        }
      })
      return count > 0 ? totalChange / count : 0
    })
    return labels.map((month, i) => ({ month, change: parseFloat(monthlyChanges[i].toFixed(2)) }))
  }, [prices, filteredTickers])

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

  const radarData = useMemo(() => {
    const subjects = ['Volatilite', 'Ort. Getiri', 'Max Kazanç', 'Tutarlılık', 'Sharpe']
    if (filteredTickers.length === 0) return subjects.map(subject => ({ subject }))
    return subjects.map(subject => {
      const point = { subject }
      filteredTickers.forEach(t => {
        const arr = prices[t]
        if (!arr || arr.length < 2) { point[t] = 0; return }
        const returns = arr.slice(1).map((p, i) => (p.close - arr[i].close) / arr[i].close)
        switch (subject) {
          case 'Volatilite': {
            const mean = returns.reduce((a, b) => a + b, 0) / returns.length
            const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length
            const vol = Math.sqrt(variance) * Math.sqrt(252) * 100
            point[t] = Math.min(100, Math.round(vol))
            break
          }
          case 'Ort. Getiri': {
            const avgReturn = (returns.reduce((a, b) => a + b, 0) / returns.length) * 100
            point[t] = Math.min(100, Math.max(0, Math.round(avgReturn * 10 + 50)))
            break
          }
          case 'Max Kazanç': {
            const maxGain = Math.max(...returns) * 100
            point[t] = Math.min(100, Math.max(0, Math.round(maxGain * 5 + 50)))
            break
          }
          case 'Tutarlılık': {
            const posDays = returns.filter(r => r > 0).length
            point[t] = Math.round((posDays / returns.length) * 100)
            break
          }
          case 'Sharpe': {
            const mean = returns.reduce((a, b) => a + b, 0) / returns.length
            const std = Math.sqrt(returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length)
            const sharpe = std > 0 ? (mean / std) * Math.sqrt(252) : 0
            point[t] = Math.min(100, Math.max(0, Math.round(sharpe * 20 + 50)))
            break
          }
          default: point[t] = 50
        }
      })
      return point
    })
  }, [prices, filteredTickers])

  const riskScore = useMemo(() => {
    const returns = monthlyChangeData.map(d => d.change / 100)
    return calculateSharpe(returns)
  }, [monthlyChangeData])

  const handleStockChange = (ticker) => {
    setTransitioning(true)
    setTimeout(() => { setActiveStock(ticker); setTransitioning(false) }, 150)
  }

  const macroData = Array.isArray(macros)
    ? Object.fromEntries(macros.map(m => [m.type?.toLowerCase(), m]))
    : (macros || {})
  const cds = macroData.cds?.value ?? macroData.cds ?? null
  const vix = macroData.vix?.value ?? macroData.vix ?? null
  const interest = macroData.interest?.value ?? macroData.interest ?? null
  const usdtry = macroData.usdtry?.value ?? macroData.usdtry ?? null

  // MarketBar mock data (Kimi style)
  const marketIndices = [
    { symbol: 'XU100', name: 'BIST 100', value: 9876.54, change: 1.24 },
    { symbol: 'XU030', name: 'BIST 30', value: 10543.21, change: 0.89 },
    { symbol: 'USDTRY', name: 'USD/TRY', value: 35.42, change: -0.15 },
    { symbol: 'EURTRY', name: 'EUR/TRY', value: 38.15, change: 0.32 },
    { symbol: 'GC=F', name: 'Altın', value: 2345.60, change: 0.67 },
    { symbol: 'BTC', name: 'Bitcoin', value: 89432.00, change: 2.45 },
    { symbol: '^IXIC', name: 'NASDAQ', value: 18500.25, change: 1.12 },
    { symbol: 'VIX', name: 'VIX', value: 14.32, change: -5.23 },
  ]

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in px-4 max-w-[1440px] mx-auto">
        <div className="grid grid-cols-5 gap-3"><ChartSkeleton height={100} /><ChartSkeleton height={100} /><ChartSkeleton height={100} /><ChartSkeleton height={100} /><ChartSkeleton height={100} /></div>
        <div className="grid grid-cols-12 gap-4"><div className="col-span-7"><ChartSkeleton height={280} /></div><div className="col-span-5"><ChartSkeleton height={280} /></div></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in px-4 max-w-[1440px] mx-auto pb-8">
      {/* Hero Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Dashboard</h1>
            <p className="text-xs text-slate-400 -mt-0.5">Piyasa özet ve portföy analizi</p>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if(search) window.location.href = `/stock/${search.toUpperCase()}`}}>
          <input type="text" placeholder="Hisse ara..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-violet-500/50 w-64 transition-all" />
        </form>
      </div>

      {/* Market Bar — Kimi Style */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {marketIndices.map((item, i) => (
          <motion.div
            key={item.symbol}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white/[0.03] backdrop-blur-md border border-white/[0.06] rounded-xl p-3 cursor-pointer hover:bg-white/[0.06] hover:border-white/10 transition-all group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">{item.name}</span>
              {item.change >= 0 ? (
                <ArrowUpRight size={12} className="text-emerald-400" />
              ) : (
                <ArrowDownRight size={12} className="text-rose-400" />
              )}
            </div>
            <div className="text-sm font-bold font-mono text-white group-hover:text-violet-300 transition-colors">
              {item.symbol.includes('USD') || item.symbol.includes('EUR')
                ? item.value.toFixed(2)
                : item.symbol === 'BTC'
                  ? item.value.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
                  : item.value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className={`text-[10px] font-mono font-semibold ${item.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
            </div>
          </motion.div>
        ))}
      </div>

      {/* KPI Cards — Kimi Style */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: TrendingUp, label: 'En Yüksek Fiyat', value: `₺${bestStock?.lastPrice?.toFixed(2) || '—'}`, sub: bestStock?.ticker, color: 'from-violet-500/10 to-violet-500/5', textColor: 'text-violet-400' },
          { icon: TrendingDown, label: 'En Düşük Fiyat', value: `₺${worstStock?.lastPrice?.toFixed(2) || '—'}`, sub: worstStock?.ticker, color: 'from-rose-500/10 to-rose-500/5', textColor: 'text-rose-400' },
          { icon: Wallet, label: 'Toplam Piyasa', value: <AnimatedNumber value={totalMarketCap / 1e12} prefix="₺" suffix="T" />, sub: `${tickers.length} hisse`, color: 'from-cyan-500/10 to-cyan-500/5', textColor: 'text-cyan-400' },
          { icon: Activity, label: 'CDS Spread', value: `${cds || '—'} bps`, sub: 'Türkiye Riski', color: 'from-amber-500/10 to-amber-500/5', textColor: 'text-amber-400' },
          { icon: Zap, label: 'VIX Endeksi', value: `${vix || '—'}`, sub: 'Volatilite', color: 'from-emerald-500/10 to-emerald-500/5', textColor: 'text-emerald-400' },
          { icon: Star, label: 'Aktif Sinyal', value: signals?.length || 0, sub: 'Son 30 gün', color: 'from-pink-500/10 to-pink-500/5', textColor: 'text-pink-400' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`bg-gradient-to-br ${kpi.color} backdrop-blur-md border border-white/[0.06] rounded-xl p-4 hover:border-white/10 transition-all`}
          >
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={`w-4 h-4 ${kpi.textColor}`} />
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">{kpi.label}</span>
            </div>
            <div className={`text-lg font-bold font-mono ${kpi.textColor}`}>{kpi.value}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{kpi.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Timeline */}
      <div className="bg-white/[0.02] backdrop-blur-md border border-white/[0.06] rounded-xl px-4 py-3">
        <TimelineSlider value={selectedMonth} onChange={setSelectedMonth} />
        <div className="flex gap-3 justify-center mt-2">
          <button onClick={() => setAutoPlay(!autoPlay)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all ${autoPlay ? 'bg-violet-600 border-violet-500 text-white' : 'border-white/10 text-slate-400 hover:text-white'}`}>
            {autoPlay ? '⏸ Durdur' : '▶ Auto-Play'}
          </button>
          <button onClick={() => setLogScale(!logScale)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all ${logScale ? 'bg-slate-700 border-slate-500 text-white' : 'border-white/10 text-slate-400 hover:text-white'}`}>
            📈 Log Scale
          </button>
        </div>
      </div>

      {/* Stock Pills */}
      <div className="flex gap-2 justify-center flex-wrap">
        {['TÜMÜ', ...tickers].map(ticker => (
          <button key={ticker} onClick={() => handleStockChange(ticker)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeStock === ticker
                ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg shadow-violet-500/20'
                : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/20'
            }`}>
            {ticker !== 'TÜMÜ' && <span className="mr-1.5 inline-block w-2 h-2 rounded-full" style={{ background: getColor(ticker) }} />}
            {ticker}
          </button>
        ))}
      </div>

      {/* Charts Grid */}
      <div className={`grid grid-cols-12 gap-4 transition-opacity duration-150 ${transitioning ? 'opacity-30' : 'opacity-100'}`}>
        <div className="col-span-12 lg:col-span-7">
          <ChartCard icon="📈" title="Aylık Performans">
            {lineChartData.length > 0 ? <PerformanceChart data={lineChartData} tickers={filteredTickers} logScale={logScale} /> : <ChartSkeleton height={280} />}
          </ChartCard>
        </div>
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">
          <ChartCard icon="📊" title="Aylık Artış / Azalış">
            <MonthlyChangeChart data={monthlyChangeData} />
          </ChartCard>
          <ChartCard icon="📉" title="Kümülatif Getiri" badge="%" badgeColor="green">
            {cumulativeData.length > 0 ? <CumulativeChart data={cumulativeData} tickers={filteredTickers} /> : <ChartSkeleton height={200} />}
          </ChartCard>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-4">
          <ChartCard icon="🎯" title="Volatilite Radar">
            <VolatilityRadar data={radarData} tickers={filteredTickers} />
          </ChartCard>
        </div>
        <div className="col-span-12 md:col-span-3">
          <ChartCard icon="⚖️" title="Risk / Ödül" badge="AI" badgeColor="ai">
            <RiskGauge score={riskScore} />
          </ChartCard>
        </div>
        <div className="col-span-12 md:col-span-5">
          <ChartCard icon="💼" title="Portföy Varlıkları">
            {portfolio.items.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                Portföyde hisse yok. <Link to="/portfolio" className="text-violet-400 hover:underline">Ekle →</Link>
              </div>
            ) : (
              <div className="overflow-auto max-h-[220px]">
                <table className="w-full data-table">
                  <thead><tr><th>⭐</th><th>Hisse</th><th className="text-right">Fiyat</th><th className="text-right">K/Z</th></tr></thead>
                  <tbody>
                    {portfolio.items.map(item => (
                      <tr key={item.ticker}>
                        <td onClick={() => toggle(item.ticker)} className="cursor-pointer text-lg px-2">{isFavorite(item.ticker) ? '⭐' : '☆'}</td>
                        <td><Link to={`/stock/${item.ticker}`} className="font-semibold text-violet-400 hover:underline">{item.ticker}</Link></td>
                        <td className="text-right font-mono text-sm">{formatCurrency(item.currentPrice)}</td>
                        <td className={`text-right font-mono text-sm font-semibold ${(item.pl||0)>=0 ? 'text-emerald-400' : 'text-rose-400'}`}>
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

      {/* Macro Analysis */}
      <div className="mt-8 pt-8 border-t border-white/5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2"><Globe size={22} className="text-cyan-400" /> Makro Ekonomik Etki</h2>
            <p className="text-xs text-slate-500 mt-1">Makro verilerin şirketlere etkisini inceleyin.</p>
          </div>
          <select value={macroCountry} onChange={e => setMacroCountry(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-violet-500/50">
            <option value="TR">Türkiye</option>
            <option value="US">Amerika</option>
            <option value="EU">Avrupa</option>
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'CDS Spread', val: `${cds || 295} bps`, desc: 'Ülke Risk Primi', color: 'rose' },
            { label: 'Politika Faizi', val: `%${(interest || 50).toFixed(2)}`, desc: 'Merkez Bankası', color: 'violet' },
            { label: 'Enflasyon', val: `%${(interest || 50).toFixed(1)}`, desc: 'TÜFE Yıllık', color: 'amber' },
            { label: 'VIX', val: `${vix || 18.2}`, desc: 'Küresel Volatilite', color: 'emerald' },
          ].map(m => (
            <div key={m.label} className="bg-white/[0.02] backdrop-blur-md border border-white/[0.06] rounded-xl p-5 relative overflow-hidden group hover:border-white/10 transition-all">
              <div className={`absolute top-0 right-0 w-24 h-24 bg-${m.color}-500/5 rounded-full blur-2xl group-hover:bg-${m.color}-500/10 transition-colors`} />
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">{m.label}</p>
              <p className={`text-3xl font-bold font-mono text-${m.color}-400 mb-1`}>{m.val}</p>
              <p className="text-xs text-slate-400">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
