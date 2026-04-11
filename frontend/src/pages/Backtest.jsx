import { useState } from 'react';
import client from '../api/client';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { Cpu, PlayCircle, Info, TrendingUp, TrendingDown, Target, AlertTriangle } from 'lucide-react';

const Backtest = () => {
  const [ticker, setTicker] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ticker) return;
    try {
      setLoading(true); setError(''); setResult(null);
      let url = `/backtest/${ticker.toUpperCase()}`;
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const query = params.toString();
      if (query) url += `?${query}`;
      const res = await client.get(url);
      if (res.data.error) setError(res.data.error);
      else setResult(res.data);
    } catch (err) { setError(err.response?.data?.error || 'Simülasyon sırasında hata oluştu.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Cpu size={24} className="text-purple" /> Sinyal Simülasyonu (Backtest)</h1>
        <p className="text-sm text-text-muted mt-1">Geçmişe dönük AL-SAT performans analizi</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Parameters */}
        <div className="glass-card neon-glow border-t-2 border-t-purple">
          <h2 className="font-bold text-sm mb-4 flex items-center gap-2"><PlayCircle size={16} className="text-purple" /> Test Parametreleri</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block uppercase tracking-wider">Hisse Kodu</label>
              <input placeholder="Örn: AKBNK" value={ticker} onChange={(e) => setTicker(e.target.value)} required className="input-field uppercase" />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block uppercase tracking-wider">Başlangıç (Opsiyonel)</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block uppercase tracking-wider">Bitiş (Opsiyonel)</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full bg-gradient-to-r from-purple to-pink hover:shadow-[0_0_24px_rgba(168,85,247,0.4)]">
              {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><PlayCircle size={14} /> Simülasyonu Başlat</>}
            </button>
          </form>
          <div className="mt-5 flex gap-2.5 text-xs p-3 rounded-lg bg-bg-primary border border-border text-text-muted">
            <Info size={14} className="shrink-0 mt-0.5 text-accent" />
            <p>Motor, hissenin geçmiş AL-SAT sinyallerini test ederek ₺10.000 başlangıç sermayesi üzerinden performans hesaplar.</p>
          </div>
        </div>

        {/* Results */}
        <div className="glass-card lg:col-span-3 min-h-[400px]">
          <h2 className="font-bold text-sm mb-4">Simülasyon Sonuçları</h2>
          {error && <div className="bg-red/10 border border-red/20 text-red text-sm p-3 rounded-lg mb-4">{error}</div>}
          {!result && !loading && !error && (
            <div className="flex flex-col items-center justify-center h-80 text-text-muted">
              <Cpu size={48} className="mb-4 opacity-20" />
              <p className="text-sm">Sonuçları görmek için testi başlatın.</p>
            </div>
          )}
          {result && (
            <div className="animate-fade-in">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="glass-card !p-4">
                  <p className="text-xs text-text-muted mb-1 uppercase tracking-wider">Final Bakiyesi</p>
                  <p className="text-xl font-bold">{formatCurrency(result.finalCapital)}</p>
                </div>
                <div className="glass-card !p-4">
                  <p className="text-xs text-text-muted mb-1 uppercase tracking-wider">Toplam Getiri</p>
                  <p className={`text-xl font-bold ${result.totalReturnPercent >= 0 ? 'text-green' : 'text-red'}`}>
                    {result.totalReturnPercent >= 0 ? '+' : ''}{formatPercent(result.totalReturnPercent)}
                  </p>
                </div>
                <div className="glass-card !p-4">
                  <p className="text-xs text-text-muted mb-1 uppercase tracking-wider">Kazanma Oranı</p>
                  <p className="text-xl font-bold text-accent">{result.winRate?.toFixed(1)}%</p>
                </div>
                <div className="glass-card !p-4">
                  <p className="text-xs text-text-muted mb-1 uppercase tracking-wider">Maks Düşüş</p>
                  <p className="text-xl font-bold text-yellow">-{result.maxDrawdownPercent?.toFixed(1)}%</p>
                </div>
              </div>
              <div className="glass-card !bg-bg-primary h-[200px] flex items-center justify-center text-text-muted text-sm">
                <Target size={20} className="mr-2 opacity-30" /> Equity (bakiye büyüme) grafiği gelecek sürümde eklenecek.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Backtest;
