import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../api/client'
import { formatCurrency, formatDate } from '../utils/formatters'
import { TrendingUp, RefreshCw, Activity, Search, Zap, ExternalLink } from 'lucide-react'
import ChartCard from '../components/ChartCard'

const SIGNAL_STYLES = {
  'GUCLU AL': 'bg-green-500/15 text-green-300 border-green-500/30',
  'AL':       'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  'BEKLE':    'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  'SAT':      'bg-pink-500/15 text-pink-300 border-pink-500/30',
  'GUCLU SAT':'bg-red-500/15 text-red-300 border-red-500/30',
}

const Signals = () => {
  const navigate = useNavigate()
  const [signals, setSignals] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchSignals = async () => {
    try { setLoading(true); const res = await client.get('/signal/history'); setSignals(res.data) }
    catch {} finally { setLoading(false) }
  }

  useEffect(() => { fetchSignals() }, [])

  const filtered = signals.filter(s => !search || s.ticker?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp size={24} className="text-cyan-400" /> Piyasa Sinyalleri</h1>
          <p className="text-sm text-slate-500 mt-1">AI destekli teknik & temel analiz sinyalleri</p>
        </div>
        <button onClick={fetchSignals} className="btn-outline"><RefreshCw size={14} /> Yenile</button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <div className="glass-card !p-0 overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <span className="text-sm font-semibold">Son Sinyaller</span>
              <div className="relative"><Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara..." className="input-field !py-1.5 !pl-8 !pr-3 !text-xs !rounded-full w-40" /></div>
            </div>
            <div className="overflow-auto max-h-[700px]">
              {loading ? <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" /></div> : (
                <table className="w-full data-table">
                  <thead><tr><th>Hisse</th><th>Tarih</th><th className="text-right">Fiyat</th><th>Skor</th><th className="text-right">Sinyal</th></tr></thead>
                  <tbody>
                    {filtered.length === 0 ? <tr><td colSpan="5" className="text-center py-10 text-slate-500">Kayıtlı sinyal yok.</td></tr> :
                    filtered.map((sig, i) => (
                      <tr key={i} onClick={() => navigate(`/stock/${sig.ticker}`)} className="cursor-pointer hover:bg-purple-500/5 transition-colors">
                        <td><Link to={`/stock/${sig.ticker}`} className="font-semibold text-purple-400 flex items-center gap-1">{sig.ticker} <ExternalLink size={12}/></Link></td>
                        <td className="text-slate-500 text-xs">{formatDate(sig.createdAt)}</td>
                        <td className="text-right font-mono text-slate-400">{formatCurrency(sig.price)}</td>
                        <td><div className="flex items-center gap-2"><div className="w-14 h-1.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" style={{ width: `${Math.min(100, Math.max(0, sig.score))}%` }} /></div><span className="text-[11px] text-slate-500 font-mono">{sig.score}</span></div></td>
                        <td className="text-right"><span className={`text-[11px] font-bold px-2 py-1 rounded-md border ${SIGNAL_STYLES[sig.signal] || SIGNAL_STYLES['BEKLE']}`}>{sig.signal}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Signals
