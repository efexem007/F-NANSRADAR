import { useState } from 'react'
import client from '../api/client'
import { formatCurrency, formatPercent } from '../utils/formatters'
import { Cpu, PlayCircle, Info } from 'lucide-react'
import ChartCard from '../components/ChartCard'

const Backtest = () => {
  const [ticker, setTicker] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  const [mode, setMode] = useState('simulate') // simulate or instant
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [instantResult, setInstantResult] = useState(null)

  const handleSimulate = async (e) => {
    e.preventDefault(); if (!ticker) return
    try {
      setLoading(true); setError(''); setResult(null); setInstantResult(null)
      if (mode === 'simulate') {
        let url = `/backtest/${ticker.toUpperCase()}`
        const params = new URLSearchParams()
        if (startDate) params.append('startDate', startDate)
        if (endDate) params.append('endDate', endDate)
        if (params.toString()) url += `?${params}`
        const res = await client.get(url)
        if (res.data.error) setError(res.data.error); else setResult(res.data)
      } else {
        const res = await client.post('/signal/calculate', { ticker: ticker.toUpperCase() })
        setInstantResult(res.data)
      }
    } catch (err) { setError(err.response?.data?.error || 'Uzak sunucu hatası') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Cpu size={24} className="text-purple-400" /> AI Laboratuvarı & Backtest</h1>
        <p className="text-sm text-slate-500 mt-1">Algoritmik stratejilerinizi test edin ve hisseleri anında analiz motoruna sokun.</p>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Sol Panel: Parametreler */}
        <div className="col-span-12 lg:col-span-4 space-y-5">
          <ChartCard icon="⚙️" title="Test Parametreleri">
            <div className="flex bg-white/5 rounded-xl p-1 mb-6 border border-white/5">
              <button onClick={() => setMode('instant')} className={`flex-1 py-2 text-[11px] font-bold uppercase rounded-lg transition-all ${mode === 'instant' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-500 hover:text-slate-300'}`}>Anlık AI Testi</button>
              <button onClick={() => setMode('simulate')} className={`flex-1 py-2 text-[11px] font-bold uppercase rounded-lg transition-all ${mode === 'simulate' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-slate-500 hover:text-slate-300'}`}>Geçmiş Simülasyon</button>
            </div>

            <form onSubmit={handleSimulate} className="space-y-4">
              <div><label className="text-xs font-semibold text-slate-400 mb-1 block uppercase tracking-wider">Varlık Kodu (Hisse / Kripto / Döviz)</label>
                <input placeholder="Örn: AKBNK veya BTC-USD" value={ticker} onChange={e => setTicker(e.target.value)} required className="input-field uppercase w-full" /></div>
              
              {mode === 'simulate' && (
                <div className="grid grid-cols-2 gap-3 animate-fade-in">
                  <div><label className="text-xs font-semibold text-slate-400 mb-1 block uppercase tracking-wider">Başlangıç</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field max-w-full text-xs" /></div>
                  <div><label className="text-xs font-semibold text-slate-400 mb-1 block uppercase tracking-wider">Bitiş</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field max-w-full text-xs" /></div>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full mt-4 !py-3">
                {loading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><PlayCircle size={16} /> {mode === 'simulate' ? 'Backtest Başlat' : 'Makinayı Çalıştır'}</>}
              </button>
            </form>
            
            {mode === 'simulate' && (
              <div className="mt-4 flex gap-2 text-xs p-3 rounded-xl bg-white/5 border border-white/5 text-slate-500">
                <Info size={14} className="shrink-0 mt-0.5 text-purple-400" />
                <p>Simülasyon ₺10.000 sanal başlangıç sermayesi üzerinden algoritmik kâr/zarar hesaplaması yapar.</p>
              </div>
            )}
          </ChartCard>
        </div>

        {/* Sağ Panel: Sonuçlar */}
        <div className="col-span-12 lg:col-span-8">
          <ChartCard icon="📊" title="Sonuç & Rapor Tablosu">
            {error && <div className="bg-red-500/10 text-red-400 text-sm p-4 rounded-xl mb-4 border border-red-500/20">{error}</div>}
            
            {!result && !instantResult && !loading && !error && (
              <div className="flex flex-col items-center justify-center h-80 text-slate-500">
                <Cpu size={56} className="mb-4 opacity-20 text-cyan-400" />
                <p className="text-sm font-medium">Sol panelden veri girerek bir test başlatın.</p>
              </div>
            )}

            {/* AI Test Sonucu */}
            {instantResult && (
              <div className="animate-fade-in p-6 bg-white/5 rounded-2xl border border-white/10 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl"></div>
                <div className="text-center mb-6 relative z-10">
                  <h3 className="text-3xl font-bold tracking-tight text-white mb-2">{instantResult.ticker}</h3>
                  <span className={`inline-block text-sm font-bold px-4 py-2 rounded-lg border ${instantResult.score >= 70 ? 'bg-green-500/20 text-green-400 border-green-500/30' : instantResult.score <= 40 ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}`}>{instantResult.signal}</span>
                </div>
                <div className="space-y-4 max-w-sm mx-auto relative z-10">
                  <div className="flex justify-between items-center"><span className="text-slate-400 text-sm uppercase tracking-wider">AI Karar Skoru</span><span className="font-mono text-xl font-bold">{instantResult.score}<span className="text-slate-500 text-sm">/100</span></span></div>
                  <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
                    <div className={`h-full transition-all ${instantResult.score >= 70 ? 'bg-green-500' : instantResult.score <= 40 ? 'bg-red-500' : 'bg-yellow-500'}`} style={{ width: `${instantResult.score}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* Backtest Sonucu */}
            {result && (
              <div className="animate-fade-in">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Final Bakiye', value: formatCurrency(result.finalCapital), color: 'text-white' },
                    { label: 'Toplam Getiri', value: `${result.totalReturnPercent >= 0 ? '+' : ''}${formatPercent(result.totalReturnPercent)}`, color: result.totalReturnPercent >= 0 ? 'text-emerald-400' : 'text-rose-400' },
                    { label: 'Kazanım Oranı', value: `${result.winRate?.toFixed(1)}%`, color: 'text-cyan-400' },
                    { label: 'Maks. Düşüş', value: `-${result.maxDrawdownPercent?.toFixed(1)}%`, color: 'text-yellow-400' },
                  ].map(c => (
                    <div key={c.label} className="glass-card !p-4 flex flex-col justify-center items-center text-center">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">{c.label}</p>
                      <p className={`text-xl font-bold font-mono ${c.color}`}>{c.value}</p>
                    </div>
                  ))}
                </div>
                {result.trades && result.trades.length > 0 ? (
                  <div className="overflow-auto border border-white/5 rounded-xl block max-h-[400px]">
                    <table className="w-full data-table">
                      <thead><tr className="sticky top-0 bg-[#0f1025] z-10"><th className="py-3 px-4 text-left">Tarih</th><th className="py-3">Aksiyon</th><th className="py-3 px-4 text-right">İşlem Fiyatı</th></tr></thead>
                      <tbody>
                        {result.trades.map((t, i) => (
                          <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="text-slate-400 py-3 px-4 text-xs">{new Date(t.date).toLocaleDateString('tr-TR')}</td>
                            <td className="py-3 text-center"><span className={`text-xs font-bold px-3 py-1 rounded-md shadow-sm ${
                              t.action === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>{t.action === 'BUY' ? 'ALIM' : 'SATIŞ'}</span></td>
                            <td className="text-right py-3 px-4 font-mono text-sm text-slate-300">{formatCurrency(t.price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-500 bg-white/5 rounded-xl border border-white/5">Bu periyotta al-sat işlemi (Trade) tetiklenmedi.</div>
                )}
              </div>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  )
}

export default Backtest
