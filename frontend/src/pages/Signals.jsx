import { useState, useEffect } from 'react';
import client from '../api/client';
import { formatCurrency, formatDate } from '../utils/formatters';
import { TrendingUp, RefreshCw, Activity, Search, Zap } from 'lucide-react';

const SIGNAL_STYLES = {
  'GUCLU AL': 'bg-green/15 text-green border-green/30',
  'AL':       'bg-accent/15 text-accent border-accent/30',
  'BEKLE':    'bg-yellow/15 text-yellow border-yellow/30',
  'SAT':      'bg-pink/15 text-pink border-pink/30',
  'GUCLU SAT':'bg-red/15 text-red border-red/30',
};

const Signals = () => {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calcTicker, setCalcTicker] = useState('');
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcResult, setCalcResult] = useState(null);
  const [search, setSearch] = useState('');

  const fetchSignals = async () => {
    try { setLoading(true); const res = await client.get('/signal/history'); setSignals(res.data); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchSignals(); }, []);

  const handleCalc = async (e) => {
    e.preventDefault();
    if (!calcTicker) return;
    try {
      setCalcLoading(true); setCalcResult(null);
      const res = await client.post('/signal/calculate', { ticker: calcTicker.toUpperCase() });
      setCalcResult(res.data);
      fetchSignals();
    } catch (err) { alert(err.response?.data?.error || 'Hata'); }
    finally { setCalcLoading(false); }
  };

  const filtered = signals.filter(s => !search || s.ticker?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp size={24} className="text-accent" /> Piyasa Sinyalleri</h1>
          <p className="text-sm text-text-muted mt-1">AI destekli teknik & temel analiz sinyalleri</p>
        </div>
        <button onClick={fetchSignals} className="btn-outline"><RefreshCw size={14} /> Yenile</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Signal Calculator */}
        <div className="glass-card neon-glow">
          <h2 className="text-base font-bold mb-1 flex items-center gap-2"><Zap size={18} className="text-yellow" /> Sinyal Motoru</h2>
          <p className="text-xs text-text-muted mb-5">Temel, teknik ve makro göstergeleri ağırlıklandırarak anlık potansiyeli skorlar.</p>
          <form onSubmit={handleCalc} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block uppercase tracking-wider">Hisse Kodu</label>
              <input placeholder="Örn: THYAO" value={calcTicker} onChange={(e) => setCalcTicker(e.target.value)} className="input-field uppercase" />
            </div>
            <button type="submit" disabled={calcLoading} className="btn-primary w-full">
              {calcLoading ? <span className="w-4 h-4 border-2 border-bg-primary border-t-transparent rounded-full animate-spin" /> : <><Activity size={14} /> Hesapla</>}
            </button>
          </form>

          {calcResult && (
            <div className="mt-6 p-4 rounded-xl bg-bg-primary border border-border animate-fade-in">
              <div className="text-center mb-3">
                <span className="text-lg font-bold">{calcResult.ticker}</span>
                <div className="mt-2">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${SIGNAL_STYLES[calcResult.signal] || SIGNAL_STYLES['BEKLE']}`}>
                    {calcResult.signal}
                  </span>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-text-muted">Toplam Skor</span><span className="font-bold">{calcResult.score}/100</span></div>
                <div className="w-full h-2 bg-bg-card rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red via-yellow to-green rounded-full transition-all" style={{ width: `${calcResult.score}%` }} />
                </div>
                <div className="flex justify-between"><span className="text-text-muted">Temel</span><span>{calcResult.fundScore}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Teknik</span><span>{calcResult.techScore}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Makro</span><span>{calcResult.macroScore}</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Signal History Table */}
        <div className="glass-card lg:col-span-2 !p-0 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold">Son Sinyaller</h2>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-text-muted" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ara..." className="input-field !py-1.5 !pl-8 !pr-3 !text-xs !rounded-full w-40" />
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <table className="w-full data-table">
                <thead><tr className="bg-bg-card">
                  <th>Hisse</th><th>Tarih</th><th className="text-right">Fiyat</th><th>Skor</th><th className="text-right">Sinyal</th>
                </tr></thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan="5" className="text-center py-10 text-text-muted">Kayıtlı sinyal yok.</td></tr>
                  ) : filtered.map((sig, i) => (
                    <tr key={i}>
                      <td className="font-semibold">{sig.ticker}</td>
                      <td className="text-text-muted text-xs">{formatDate(sig.createdAt)}</td>
                      <td className="text-right font-mono text-text-secondary">{formatCurrency(sig.price)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-14 h-1.5 bg-bg-card rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-red via-yellow to-green" style={{ width: `${Math.min(100, Math.max(0, sig.score))}%` }} />
                          </div>
                          <span className="text-[11px] text-text-muted font-mono">{sig.score}</span>
                        </div>
                      </td>
                      <td className="text-right">
                        <span className={`text-[11px] font-bold px-2 py-1 rounded-md border ${SIGNAL_STYLES[sig.signal] || SIGNAL_STYLES['BEKLE']}`}>{sig.signal}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signals;
