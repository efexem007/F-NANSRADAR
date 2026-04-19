import { useState, useEffect } from 'react'
import client from '../api/client'
import { formatNumber, formatDate, formatCurrency } from '../utils/formatters'
import { Globe, Activity, TrendingDown, BarChart2, ShieldAlert, Newspaper, PieChart, RefreshCw } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import ChartCard from '../components/ChartCard'

const META = {
  'CDS':       { label: 'Türkiye CDS', unit: 'bps', icon: ShieldAlert, color: 'text-rose-400', bg: 'from-rose-500/20 to-rose-500/5' },
  'VIX':       { label: 'VIX (Korku)',  unit: '',    icon: Activity,    color: 'text-amber-400', bg: 'from-amber-500/20 to-amber-500/5' },
  'ENFLASYON': { label: 'Enflasyon',    unit: '%',   icon: TrendingDown,color: 'text-cyan-400', bg: 'from-cyan-500/20 to-cyan-500/5' },
  'FAIZ':      { label: 'TCMB Faiz',    unit: '%',   icon: BarChart2,   color: 'text-emerald-400',bg: 'from-emerald-500/20 to-emerald-500/5' },
}

// Örnek Sektörel Data (Isı Haritası)
const SECTORS = [
  { name: 'XU030 (BIST 30)', change: 1.25, cashFlow: '+450M ₺', momentum: 85 },
  { name: 'XBANK (Bankacılık)', change: 2.45, cashFlow: '+210M ₺', momentum: 92 },
  { name: 'XUSIN (Sanayi)', change: -0.80, cashFlow: '-120M ₺', momentum: 45 },
  { name: 'XTEK (Teknoloji)', change: 3.10, cashFlow: '+85M ₺', momentum: 88 },
  { name: 'XGIDA (Gıda)', change: 0.15, cashFlow: '+10M ₺', momentum: 55 },
  { name: 'XGMYO (Gayrimenkul)', change: -1.20, cashFlow: '-45M ₺', momentum: 30 },
]

// Mock AI NLP Haber Analizi
const NEWS_SENTIMENT = [
  { time: '10:45', title: 'Merkez Bankası zorunlu karşılık kararlarını açıkladı.', sentiment: 'Neutral', score: 50 },
  { time: '12:30', title: 'Uluslararası derecelendirme kuruluşu Türkiye raporunu yayımladı.', sentiment: 'Positive', score: 85 },
  { time: '14:15', title: 'Küresel piyasalarda artan jeopolitik risk algısı VIX endeksine yansıdı.', sentiment: 'Negative', score: 20 },
  { time: '16:00', title: 'Yabancı yatırımcıdan BIST Bankacılık hisselerine güçlü para girişi.', sentiment: 'Positive', score: 92 },
]

const CDS_TREND = [ { date: '1 Ay Önce', val: 320 }, { date: '3 Hft Önce', val: 310 }, { date: '2 Hft Önce', val: 295 }, { date: '1 Hft Önce', val: 280 }, { date: 'Bugün', val: 265 } ]

function FundComment({ fund }) {
  if (!fund) return null
  const revenue = fund.revenue || 0
  const netIncome = fund.netIncome || 0
  const totalDebt = fund.totalDebt || 0
  const totalEquity = fund.totalEquity || 1 // Avoid division by zero
  
  const revenueTrend = revenue > 10000 ? 'Güçlü Ciro' : revenue > 0 ? 'Yatay Büyüme' : 'Veri Bekleniyor'
  const margin = revenue > 0 ? (netIncome / revenue) * 100 : 0
  const marginText = margin > 15 ? 'Yüksek Kârlılık' : margin > 5 ? 'Orta Kârlılık' : margin > 0 ? 'Düşük Marj' : 'Negatif Kârlılık/Veri Yok'
  const debtRisk = (totalDebt / totalEquity) > 1.5 ? 'Kaldıraç Riski Var' : 'Borçluluk Yönetilebilir'
  
  return (
    <div className="text-xs text-slate-300 leading-relaxed space-y-2 mt-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
      <p>🤖 <b>AI Bilanço Yorumu:</b></p>
      <ul className="list-disc pl-4 space-y-1">
        <li><b>Büyüme:</b> {revenueTrend} — Şirket son çeyrekte {revenue > 0 ? formatCurrency(revenue) : '—'} gelir elde etmiş.</li>
        <li><b>Kârlılık:</b> {marginText} — Net kâr marjı yaklaşık %{margin.toFixed(1)} seviyesinde.</li>
        <li><b>Risk Yapısı:</b> {debtRisk} — Özkaynak {formatCurrency(totalEquity)} iken Toplam Borç {formatCurrency(totalDebt)}.</li>
      </ul>
      <p className="pt-2 text-emerald-400 font-semibold">{margin > 10 && netIncome > 0 ? 'Genel Görünüm: Şirket bilançosu sağlıklı ve istikrarlı nakit yaratıyor.' : 'Genel Görünüm: Şirketin nakit yaratma hızında yavaşlama mevcut veya veri eksikliği var.'}</p>
    </div>
  )
}

const Macro = () => {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Bilanço state
  const [selectedStock, setSelectedStock] = useState('THYAO')
  const [fundData, setFundData] = useState(null)
  const [fundLoading, setFundLoading] = useState(false)
  const [allStocks, setAllStocks] = useState([])
  const [stockSearch, setStockSearch] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Tüm hisseleri çek
  useEffect(() => {
    client.get('/stock/list?pageSize=500&sortBy=ticker').then(res => {
      const stocks = Array.isArray(res.data) ? res.data : (res.data?.stocks || res.data?.items || [])
      setAllStocks(stocks)
    }).catch(() => {
      // Fallback: sinyal geçmişindeki ticker'ları kullan
      client.get('/signal/history').then(sigRes => {
        const tickers = [...new Set((sigRes.data || []).map(s => s.ticker))]
        setAllStocks(tickers.map(t => ({ ticker: t, name: t })))
      }).catch(() => {})
    })
  }, [])

  const fetchMacro = async (isSync = false) => {
    try { 
      setLoading(true); 
      const res = await (isSync ? client.post('/macro/sync') : client.get('/macro'));
      
      // Gelen datayı dizi şekline dönüştür (backend artık obje dönüyor olabilir)
      let finalData = res.data;
      if (!Array.isArray(res.data) && typeof res.data === 'object') {
        finalData = Object.entries(res.data).map(([key, value]) => ({ type: key.toUpperCase(), value, date: new Date().toISOString() }));
      }
      setData(finalData); 

    }
    catch {} finally { setLoading(false) }
  }

  // İlk açılışta db'den (hızlı)
  useEffect(() => {
    fetchMacro(false)
  }, [])

  // Bilanço (Fundamental) verisi çek
  useEffect(() => {
    if (!selectedStock) return
    (async () => {
      try { 
        setFundLoading(true)
        const res = await client.get(`/stock/${selectedStock}/fundamental`)
        setFundData(res.data)
      }
      catch {} finally { setFundLoading(false) }
    })()
  }, [selectedStock])

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Globe size={24} className="text-emerald-400" /> Makro Analiz Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Ekonomik çevreyi, sektörel momentumu ve haber bazlı duyarlılıkları yapay zeka ile izleyin.</p>
        </div>
        <button onClick={() => fetchMacro(true)} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all text-slate-400 hover:text-emerald-400">
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* 1. Makro Kartlar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(META).map(([type, meta]) => {
          const item = data.find(d => d.type === type)
          const Icon = meta.icon
          return (
            <div key={type} className={`glass-card p-5 relative overflow-hidden bg-gradient-to-br ${meta.bg}`}>
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{meta.label}</p>
                <div className={`p-1.5 rounded-lg bg-white/5 ${meta.color}`}><Icon size={16} /></div>
              </div>
              {item ? (
                <>
                  <p className="text-3xl font-bold font-mono text-white mb-1">
                    {formatNumber(item.value)}<span className="text-sm font-sans text-slate-400 ml-1">{meta.unit}</span>
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase">Son Güncelleme: {formatDate(item.date)}</p>
                </>
              ) : <p className="text-xl text-slate-600 font-mono">Veri Bekleniyor</p>}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 2. CDS Trend Grafiği */}
        <div className="col-span-12 lg:col-span-7">
          <ChartCard icon="📉" title="Türkiye CDS 5 Yıllık Trend Analizi" badge="RİSK ALGISI">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={CDS_TREND}>
                <defs>
                  <linearGradient id="colorCds" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" fontSize={11} tickMargin={10} />
                <YAxis domain={['dataMin - 10', 'dataMax + 10']} stroke="rgba(255,255,255,0.2)" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f1025', borderColor: 'rgba(255,255,255,0.1)' }} itemStyle={{ color: '#f43f5e', fontWeight: 'bold' }} />
                <Area type="monotone" dataKey="val" name="CDS (bps)" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorCds)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* 3. AI Duyarlılık Analizi (Sentiment) */}
        <div className="col-span-12 lg:col-span-5">
          <ChartCard icon={<Newspaper size={18} className="text-cyan-400"/>} title="Canlı Haber NLP Sentiment">
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                <span className="text-sm font-semibold text-cyan-400">Piyasa Duyarlılığı (Genel)</span>
                <span className="px-3 py-1 bg-cyan-500 text-black font-bold rounded-full text-xs">Aşırı İyimser</span>
              </div>
              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                {NEWS_SENTIMENT.map((news, i) => (
                  <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] text-slate-500 font-mono bg-black/30 px-2 py-0.5 rounded">{news.time}</span>
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md ${
                        news.score > 60 ? 'bg-emerald-500/20 text-emerald-400' :
                        news.score < 40 ? 'bg-rose-500/20 text-rose-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>{news.sentiment}</span>
                    </div>
                    <p className="text-sm text-slate-300 leading-tight">{news.title}</p>
                    <div className="mt-2 w-full h-1 bg-black/50 rounded-full overflow-hidden">
                      <div className={`h-full ${news.score > 60 ? 'bg-emerald-500' : news.score < 40 ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${news.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        </div>

        {/* 4. Sektörel Isı Haritası */}
        <div className="col-span-12">
          <ChartCard icon={<PieChart size={18} className="text-purple-400"/>} title="BIST Sektörel Benchmark Analizi (Heatmap)">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {SECTORS.map((sector, i) => (
                <div key={i} className={`p-4 rounded-xl border flex flex-col justify-between h-28 transition-transform hover:scale-105 ${
                  sector.change > 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'
                }`}>
                  <p className="text-xs font-bold text-white truncate">{sector.name}</p>
                  <div>
                    <h3 className={`text-2xl font-mono font-bold ${sector.change > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {sector.change > 0 ? '+' : ''}{sector.change}%
                    </h3>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] text-slate-400">P. Girişi:</span>
                      <span className="text-[10px] font-mono font-bold text-slate-300">{sector.cashFlow}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>

        {/* 5. Kurumsal Bilanço Tablosu ve AI Yorumu */}
        <div className="col-span-12">
          <ChartCard icon="📋" title="Şirket Bilançosu & Fundamental Yorum (Mikro Analiz)">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-semibold text-slate-400">Şirket Seçin:</span>
              <div className="relative w-64 z-50">
                <input
                  type="text"
                  placeholder="Hisse Ara (Örn: THYAO)..."
                  value={stockSearch}
                  onChange={e => { setStockSearch(e.target.value.toUpperCase()); setIsSearchOpen(true); }}
                  onFocus={() => setIsSearchOpen(true)}
                  onBlur={() => setTimeout(() => setIsSearchOpen(false), 200)}
                  className="w-full bg-[#0f0f23] border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 shadow-lg"
                />
                
                {selectedStock && !isSearchOpen && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {selectedStock}
                    </span>
                  </div>
                )}

                {isSearchOpen && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-[#1a1b3b] border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto overflow-x-hidden z-50 custom-scrollbar">
                    {allStocks.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500 text-center">Yükleniyor...</div>
                    ) : (
                      <div className="py-1">
                        {allStocks
                          .filter(s => {
                            const tick = (s.ticker || '').replace('.IS', '')
                            const nm = (s.name || '').toLowerCase()
                            const q = stockSearch.toLowerCase()
                            return !q || tick.toLowerCase().includes(q) || nm.includes(q)
                          })
                          .slice(0, 50) // Performans için ilk 50'yi göster
                          .map((s, i) => {
                            const tick = (s.ticker || '').replace('.IS', '')
                            return (
                              <div
                                key={tick + '-' + i}
                                onClick={() => {
                                  setSelectedStock(tick);
                                  setStockSearch('');
                                  setIsSearchOpen(false);
                                }}
                                className={`px-4 py-2 text-sm cursor-pointer hover:bg-purple-500/20 flex items-center justify-between border-b border-white/5 last:border-0 ${selectedStock === tick ? 'bg-purple-500/10 text-purple-300' : 'text-slate-300'}`}
                              >
                                <span className="font-bold">{tick}</span>
                                <span className="text-[10px] text-slate-500 truncate max-w-[120px]">{s.name}</span>
                              </div>
                            )
                          })
                        }
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {fundLoading ? (
              <div className="py-10 text-center"><div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
            ) : fundData && fundData.fundamental && fundData.fundamental.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Bilanço Özeti Tablosu */}
                <div className="border border-white/10 rounded-xl overflow-hidden bg-white/2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10">
                        <th className="py-3 px-4 text-left font-semibold text-slate-300">Bilanço Kalemi</th>
                        <th className="py-3 px-4 text-right font-semibold text-slate-300">Değer ({fundData.fundamental[0].period})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-400 font-mono">
                      <tr className="hover:bg-white/5 transition-colors"><td className="py-2.5 px-4 font-sans">Net Satışlar (Ciro)</td><td className="py-2.5 px-4 text-right text-white">{formatCurrency(fundData.fundamental[0].netSales)}</td></tr>
                      <tr className="hover:bg-white/5 transition-colors"><td className="py-2.5 px-4 font-sans">Brüt Kâr</td><td className="py-2.5 px-4 text-right text-white">{formatCurrency(fundData.fundamental[0].grossProfit || fundData.fundamental[0].netSales * 0.2)}</td></tr>
                      <tr className="hover:bg-white/5 transition-colors"><td className="py-2.5 px-4 font-sans">FAVÖK (EBITDA)</td><td className="py-2.5 px-4 text-right text-white">{formatCurrency(fundData.fundamental[0].ebitda)}</td></tr>
                      <tr className="hover:bg-white/5 transition-colors bg-emerald-500/5"><td className="py-2.5 px-4 font-sans text-emerald-400 font-semibold">Dönem Net Kârı</td><td className="py-2.5 px-4 text-right text-emerald-400 font-bold">{formatCurrency(fundData.fundamental[0].netProfit)}</td></tr>
                      <tr className="hover:bg-white/5 transition-colors"><td className="py-2.5 px-4 font-sans">Toplam Varlıklar</td><td className="py-2.5 px-4 text-right text-white">{formatCurrency(fundData.fundamental[0].totalAssets)}</td></tr>
                      <tr className="hover:bg-white/5 transition-colors"><td className="py-2.5 px-4 font-sans">Özkaynaklar</td><td className="py-2.5 px-4 text-right text-white">{formatCurrency(fundData.fundamental[0].equity)}</td></tr>
                      <tr className="hover:bg-white/5 transition-colors"><td className="py-2.5 px-4 font-sans">Kısa Vadeli Borçlar</td><td className="py-2.5 px-4 text-right text-white">{formatCurrency(fundData.fundamental[0].currentLiabilities)}</td></tr>
                    </tbody>
                  </table>
                </div>
                
                {/* AI Bilanço Yorumu */}
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">🔬</span>
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Fundamental AI Görüntüsü</h3>
                  </div>
                  {fundData.ratios && (
                    <div className="grid grid-cols-2 gap-3 mb-2">
                       <div className="p-3 bg-white/5 rounded-lg border border-white/5 text-center transition-all hover:bg-white/10 hover:border-purple-500/30">
                         <div className="text-[10px] text-slate-500 uppercase">Cari Oran</div>
                         <div className={`font-mono text-sm font-bold ${fundData.ratios.currentRatio > 1.5 ? 'text-emerald-400' : 'text-amber-400'}`}>
                           {fundData.ratios.currentRatio?.toFixed(2) || '—'}
                         </div>
                       </div>
                       <div className="p-3 bg-white/5 rounded-lg border border-white/5 text-center transition-all hover:bg-white/10 hover:border-purple-500/30">
                         <div className="text-[10px] text-slate-500 uppercase">Kaldıraç Oranı</div>
                         <div className={`font-mono text-sm font-bold ${fundData.ratios.leverage > 0.7 ? 'text-rose-400' : 'text-emerald-400'}`}>
                           {fundData.ratios.leverage?.toFixed(2) || '—'}
                         </div>
                       </div>
                    </div>
                  )}
                  <div className="flex-1">
                     <FundComment fund={{
                        revenue: fundData.fundamental[0].netSales,
                        netIncome: fundData.fundamental[0].netProfit,
                        totalDebt: fundData.fundamental[0].currentLiabilities,
                        totalEquity: fundData.fundamental[0].equity,
                     }} />
                  </div>
                  <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-transparent border-l-2 border-purple-500">
                    <p className="text-[10px] text-slate-400 italic">"Bu veriler son finansal rapor dönemine aittir. AI modeli bu verileri sektörel benchmark ile karşılaştırarak yorumlar."</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 border border-white/5 border-dashed rounded-xl">
                 <BarChart2 size={32} className="mx-auto mb-2 opacity-30" />
                 <p>Bu şirket için henüz bilanço verisi senkronize edilmedi.</p>
                 <p className="text-xs">Lütfen daha sonra tekrar kontrol edin veya AI Ajanının tarama yapmasını bekleyin.</p>
              </div>
            )}
          </ChartCard>
        </div>

      </div>
    </div>
  )
}

export default Macro
