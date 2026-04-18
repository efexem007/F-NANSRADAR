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
import { TrendingUp, Globe } from 'lucide-react'

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

  // Makro Seleksiyonları
  const [macroCountry, setMacroCountry] = useState('TR')
  const [macroCompany, setMacroCompany] = useState('TÜMÜ')
  const [allTickersList, setAllTickersList] = useState([])
  const [compareA, setCompareA] = useState('AKBNK')
  const [compareB, setCompareB] = useState('THYAO')

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
        const [portRes, macroRes, sigRes, listRes] = await Promise.all([
          client.get('/portfolio'),
          client.get('/macro'),
          client.get('/signal/history'),
          client.get('/stock/list?pageSize=1000')
        ])
        setPortfolio(portRes.data)
        setMacros(macroRes.data)
        setSignals(sigRes.data)
        const allList = listRes.data.items || []
        setAllTickersList(allList)

        const portItems = portRes.data.items || []
        const portTickers = portItems.map(i => i.ticker.replace('.IS', ''))
        const activeTickers = Array.from(new Set([compareA, compareB, ...portTickers])).slice(0, 8)
        
        const priceData = {}
        for (const ticker of activeTickers) {
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
  }, [compareA, compareB])

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
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 glass-card p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">FinansRadar Dashboard</div>
            <div className="text-xs text-slate-400 -mt-0.5 font-medium tracking-wider">BORSA ANALİZ & TAHMİN</div>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Kıyasla:</span>
            <select value={compareA} onChange={e => setCompareA(e.target.value)} className="bg-[#0f1025] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500/50 cursor-pointer">
              {allTickersList.map(s => (
                <option key={s.ticker} value={s.ticker.replace('.IS', '')}>{s.ticker.replace('.IS', '')}</option>
              ))}
            </select>
          </div>
          <div className="w-px h-6 bg-white/10" />
          <div className="flex items-center gap-2">
            <select value={compareB} onChange={e => setCompareB(e.target.value)} className="bg-[#0f1025] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50 cursor-pointer">
              {allTickersList.map(s => (
                <option key={s.ticker} value={s.ticker.replace('.IS', '')}>{s.ticker.replace('.IS', '')}</option>
              ))}
            </select>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); if(search) window.location.href = `/stock/${search.toUpperCase()}`}}>
          <input type="text" placeholder="Hisse ara..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-[#0f1025] border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-purple-500/50 w-48" />
        </form>
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

      {/* Küresel Makro & Şirket Bağlantısı */}
      <div className="mt-8 pt-8 border-t border-white/10 animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2"><Globe size={22} className="text-cyan-400" /> Makro Ekonomik Etki Analizi</h2>
            <p className="text-xs text-slate-500 mt-1">Seçili ülkenin makro verilerinin şirketlere olası etkilerini inceleyin.</p>
          </div>
          <div className="flex gap-3">
            <select value={macroCountry} onChange={e => setMacroCountry(e.target.value)} className="bg-[#0f1025] border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-300 focus:outline-none focus:border-cyan-500/50">
              <option value="TR">🇹🇷 Türkiye</option>
              <option value="US">🇺🇸 Amerika Birleşik Devletleri</option>
              <option value="EU">🇪🇺 Avrupa Birliği</option>
            </select>
            <select value={macroCompany} onChange={e => setMacroCompany(e.target.value)} className="bg-[#0f1025] border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-300 focus:outline-none focus:border-purple-500/50">
              <option value="TÜMÜ">Tüm Şirketler (Genel)</option>
              {tickers.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { id: 'cds', label: 'Ülke Risk Primi (CDS)', val: macroCountry === 'TR' ? `${cds?.value || 295} bps` : macroCountry === 'US' ? '35 bps' : '65 bps', desc: 'Yabancı yatırımcı güveni', color: macroCountry === 'TR' ? 'rose' : 'emerald' },
            { id: 'faiz', label: 'Politika Faizi', val: macroCountry === 'TR' ? '%50.00' : macroCountry === 'US' ? '%5.25' : '%4.00', desc: 'Borçlanma maliyeti', color: 'purple' },
            { id: 'enflasyon', label: 'Enflasyon (TÜFE)', val: macroCountry === 'TR' ? '%68.5' : macroCountry === 'US' ? '%3.1' : '%2.8', desc: 'Fiyat istikrarı', color: macroCountry === 'TR' ? 'yellow' : 'cyan' },
            { id: 'vix', label: 'Küresel Volatilite (VIX)', val: `${vix?.value || 18.2}`, desc: 'Küresel korku seviyesi', color: 'emerald' },
          ].map(m => (
            <div key={m.id} className="glass-card !p-5 relative overflow-hidden group">
              <div className={`absolute top-0 right-0 w-24 h-24 bg-${m.color}-500/5 rounded-full blur-2xl group-hover:bg-${m.color}-500/10 transition-colors`}></div>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">{m.label}</p>
              <p className={`text-3xl font-bold font-mono text-${m.color}-400 mb-1`}>{m.val}</p>
              <p className="text-xs text-slate-400">{m.desc}</p>
              {macroCompany !== 'TÜMÜ' && (
                <div className="mt-4 pt-3 border-t border-white/5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">{macroCompany} Etkisi:</span>
                    <span className={`font-bold ${m.id === 'faiz' && macroCountry === 'TR' ? 'text-rose-400' : m.id === 'cds' && macroCountry === 'TR' ? 'text-yellow-400' : 'text-emerald-400'}`}>
                      {m.id === 'faiz' && macroCountry === 'TR' ? 'Yüksek Borç Maliyeti (-)' : m.id === 'cds' && macroCountry === 'TR' ? 'Yabancı Girişi Gecikmeli' : 'Pozitif / Nötr Koruma (+)'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
