import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import toast from 'react-hot-toast';
import { Dices, Play, RefreshCw } from 'lucide-react';

export default function MonteCarlo() {
  const [ticker, setTicker] = useState('THYAO');
  const [days, setDays] = useState(252);
  const [simulations, setSimulations] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const runSimulation = async () => {
    setLoading(true);
    try {
      const { data } = await client.get(`/stock/${ticker}/monte-carlo?days=${days}&simulations=${simulations}`);
      setResult(data);
      toast.success('Simülasyon tamamlandı');
    } catch (err) {
      toast.error('Simülasyon başarısız');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 animate-fade-in px-4 max-w-[1440px] mx-auto pb-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
          <Dices className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Monte Carlo Simülasyonu</h1>
          <p className="text-xs text-slate-400 -mt-0.5">Gelecek fiyat senaryolarını simüle edin</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Hisse</label>
          <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Gün Sayısı</label>
          <input type="number" value={days} onChange={e => setDays(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Simülasyon Sayısı</label>
          <input type="number" value={simulations} onChange={e => setSimulations(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
        </div>
      </div>

      <button
        onClick={runSimulation}
        disabled={loading}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transition-all disabled:opacity-50"
      >
        {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
        Simülasyonu Başlat
      </button>

      {result && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Sonuçlar</h3>
          <pre className="text-xs text-slate-300 overflow-auto">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
