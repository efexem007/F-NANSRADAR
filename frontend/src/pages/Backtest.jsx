import { useState } from 'react'
import client from '../api/client'
import { formatCurrency, formatPercent } from '../utils/formatters'
import { Cpu, PlayCircle, Info } from 'lucide-react'
import ChartCard from '../components/ChartCard'

const Backtest = () => {
  const [ticker, setTicker] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault(); if (!ticker) return
    try {
      setLoading(true); setError(''); setResult(null)
      let url = `/backtest/${ticker.toUpperCase()}`
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (params.toString()) url += `?${params}`
      const res = await client.get(url)
      if (res.data.error) setError(res.data.error); else setResult(res.data)
    } catch (err) { setError(err.response?.data?.error || 'Hata') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Cpu size={24} className="text-purple-400" /> Sinyal Simülasyonu</h1>
        <p className="text-sm text-slate-500 mt-1">Geçmişe dönük AL-SAT performans analizi</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4">
          <ChartCard icon="🎮" title="Parametreler">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="text-xs font-semibold text-slate-400 mb-1 block uppercase tracking-wider">Hisse</label>
                <input placeholder="AKBNK" value={ticker} onChange={e => setTicker(e.target.value)} required className="input-field uppercase" /></div>
              <div><label className="text-xs font-semibold text-slate-400 mb-1 block uppercase tracking-wider">Başlangıç</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field" /></div>
              <div><label className="text-xs font-semibold text-slate-400 mb-1 block uppercase tracking-wider">Bitiş</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field" /></div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><PlayCircle size={14} /> Simülasyonu Başlat</>}
              </button>
            </form>
            <div className="mt-4 flex gap-2 text-xs p-3 rounded-lg bg-white/5 border border-white/5 text-slate-500">
              <Info size={14} className="shrink-0 mt-0.5 text-purple-400" />
              <p>₺10.000 başlangıç sermayesi üzerinden hesaplama yapar.</p>
            </div>
          </ChartCard>
        </div>

        <div className="col-span-8">
          <ChartCard icon="📊" title="Sonuçlar">
            {error && <div className="bg-red-500/10 text-red-400 text-sm p-3 rounded-lg mb-4">{error}</div>}
            {!result && !loading && !error && (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500"><Cpu size={48} className="mb-4 opacity-20" /><p className="text-sm">Testi başlatın.</p></div>
            )}
            {result && (
              <div className="animate-fade-in">
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Final Bakiye', value: formatCurrency(result.finalCapital), color: 'text-white' },
                    { label: 'Toplam Getiri', value: `${result.totalReturnPercent >= 0 ? '+' : ''}${formatPercent(result.totalReturnPercent)}`, color: result.totalReturnPercent >= 0 ? 'text-green-400' : 'text-red-400' },
                    { label: 'Kazanma Oranı', value: `${result.winRate?.toFixed(1)}%`, color: 'text-cyan-400' },
                    { label: 'Maks Düşüş', value: `-${result.maxDrawdownPercent?.toFixed(1)}%`, color: 'text-yellow-400' },
                  ].map(c => (
                    <div key={c.label} className="glass-card !p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{c.label}</p>
                      <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  )
}

export default Backtest
