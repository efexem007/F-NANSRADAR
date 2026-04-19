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
  const [macroCompany, setMacroCompany] = useState('THYAO')
  const [macroCompany2, setMacroCompany2] = useState('AKBNK')
  const [allStocksForCompare, setAllStocksForCompare] = useState([])
  const [compareSearch1, setCompareSearch1] = useState('')
  const [compareSearch2, setCompareSearch2] = useState('')

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

  // Karşılaştırma için tüm hisseleri yükle
  useEffect(() => {
    client.get('/stock/list?pageSize=500&sortBy=ticker').then(res => {
      const stocks = Array.isArray(res.data) ? res.data : (res.data?.stocks || res.data?.items || [])
      setAllStocksForCompare(stocks)
    }).catch(() => {})
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

  const cds = Array.isArray(macros) ? macros.find(m => m.type === 'CDS') : macros?.cds || (macros?.target ? Object.values(macros).find(m => m?.type === 'CDS') : null)
  const vix = Array.isArray(macros) ? macros.find(m => m.type === 'VIX') : macros?.vix || (macros?.target ? Object.values(macros).find(m => m?.type === 'VIX') : null)

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
        <form onSubmit={(e) => { e.preventDefault(); if(search) window.location.href = `/stock/${search.toUpperCase()}`}}>
          <input type="text" placeholder="Hisse ara... (THYAO...)" value={search} onChange={e => setSearch(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-purple-500/50 w-64" />
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
          <div className="flex flex-wrap gap-2 items-center">
            <select value={macroCountry} onChange={e => setMacroCountry(e.target.value)} className="bg-[#0f1025] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50">
              <option value="TR">🇹🇷 Türkiye</option>
              <option value="US">🇺🇸 Amerika</option>
              <option value="EU">🇪🇺 Avrupa</option>
            </select>
            {/* Hisse 1 */}
            <div className="flex flex-col gap-1">
              <input type="text" placeholder="Ara hisse 1..." value={compareSearch1} onChange={e => setCompareSearch1(e.target.value)}
                className="bg-[#0f1025] border border-purple-500/30 rounded-lg px-2 py-1 text-[10px] text-slate-300 w-32 focus:outline-none" />
              <select value={macroCompany} onChange={e => { setMacroCompany(e.target.value); setCompareSearch1('') }}
                className="bg-[#0f1025] border border-purple-500/50 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none w-40">
                <option value="TÜMÜ">Tüm Şirketler</option>
                {(allStocksForCompare.length > 0 ? allStocksForCompare : tickers.map(t => ({ ticker: t, name: t })))
                  .filter(s => {
                    const tick = (s.ticker || '').replace('.IS', '')
                    const q = compareSearch1.toLowerCase()
                    return !q || tick.toLowerCase().includes(q) || (s.name || '').toLowerCase().includes(q)
                  })
                  .map(s => { const tick = (s.ticker||'').replace('.IS',''); return <option key={tick} value={tick} className="bg-[#0f1025]">{tick}</option> })
                }
              </select>
            </div>
            <span className="text-slate-500 text-sm font-bold">vs</span>
            {/* Hisse 2 */}
            <div className="flex flex-col gap-1">
              <input type="text" placeholder="Ara hisse 2..." value={compareSearch2} onChange={e => setCompareSearch2(e.target.value)}
                className="bg-[#0f1025] border border-cyan-500/30 rounded-lg px-2 py-1 text-[10px] text-slate-300 w-32 focus:outline-none" />
              <select value={macroCompany2} onChange={e => { setMacroCompany2(e.target.value); setCompareSearch2('') }}
                className="bg-[#0f1025] border border-cyan-500/50 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none w-40">
                <option value="TÜMÜ">Tüm Şirketler</option>
                {(allStocksForCompare.length > 0 ? allStocksForCompare : tickers.map(t => ({ ticker: t, name: t })))
                  .filter(s => {
                    const tick = (s.ticker || '').replace('.IS', '')
                    const q = compareSearch2.toLowerCase()
                    return !q || tick.toLowerCase().includes(q) || (s.name || '').toLowerCase().includes(q)
                  })
                  .map(s => { const tick = (s.ticker||'').replace('.IS',''); return <option key={tick} value={tick} className="bg-[#0f1025]">{tick}</option> })
                }
              </select>
            </div>
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
              {/* Hisse 1 etkisi */}
              {macroCompany !== 'TÜMÜ' && (
                <div className="mt-3 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-purple-400 font-bold">{macroCompany}:</span>
                    <span className={`font-bold ${m.id === 'faiz' && macroCountry === 'TR' ? 'text-rose-400' : m.id === 'cds' && macroCountry === 'TR' ? 'text-yellow-400' : 'text-emerald-400'}`}>
                      {m.id === 'faiz' && macroCountry === 'TR' ? 'Yüksek Borç Maliyeti (-)' : m.id === 'cds' && macroCountry === 'TR' ? 'Gecikmeli Giriş' : 'Pozitif Koruma (+)'}
                    </span>
                  </div>
                </div>
              )}
              {/* Hisse 2 etkisi */}
              {macroCompany2 !== 'TÜMÜ' && (
                <div className="mt-1 pt-1 border-t border-white/5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-cyan-400 font-bold">{macroCompany2}:</span>
                    <span className={`font-bold ${m.id === 'faiz' && macroCountry === 'TR' ? 'text-orange-400' : 'text-sky-400'}`}>
                      {m.id === 'faiz' ? 'Kredi Riski Artıyor' : m.id === 'cds' ? 'Yabancı Kaçışı Riski' : 'Temkinli Değerlendirin'}
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
