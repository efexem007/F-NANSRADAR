import { useState, useEffect } from 'react';
import client from '../api/client';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoadingSpinner, ErrorAlert } from '../components/ui/Feedback';
import { TrendingUp, RefreshCw, Activity, Search } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';

const SignalBadge = ({ signal }) => {
  const styles = {
    'GUCLU AL': 'bg-[#00ff88]/20 text-[#00ff88] border-[#00ff88]',
    'AL': 'bg-[#00d4ff]/20 text-[#00d4ff] border-[#00d4ff]',
    'BEKLE': 'bg-amber-500/20 text-amber-400 border-amber-500',
    'SAT': 'bg-orange-500/20 text-orange-400 border-orange-500',
    'GUCLU SAT': 'bg-[#ff4757]/20 text-[#ff4757] border-[#ff4757]'
  };
  const currentStyle = styles[signal] || styles['BEKLE'];
  
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-bold border ${currentStyle} whitespace-nowrap`}>
      {signal || 'BEKLE'}
    </span>
  );
};

const Signals = () => {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [calcTicker, setCalcTicker] = useState('');
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcResult, setCalcResult] = useState(null);

  const fetchSignals = async () => {
    try {
      setLoading(true);
      const res = await client.get('/signal/history');
      setSignals(res.data);
    } catch (err) {
      setError('Sinyal verileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
  }, []);

  const handleCalculate = async (e) => {
    e.preventDefault();
    if (!calcTicker) return;
    try {
      setCalcLoading(true);
      setCalcResult(null);
      const res = await client.post('/signal/calculate', { ticker: calcTicker.toUpperCase() });
      setCalcResult(res.data);
      fetchSignals(); // Refresh history
    } catch (err) {
       alert(err.response?.data?.error || 'Hesaplama hatası');
    } finally {
      setCalcLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <TrendingUp className="text-[#00d4ff]" size={32} />
          Piyasa Sinyalleri
        </h1>
        <Button variant="outline" onClick={fetchSignals} className="gap-2">
          <RefreshCw size={16} /> Yenile
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Activity className="text-[#9b51e0]" /> Sinyal Algoritması
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            FinansRadar AI, teknik, temel ve makro ekonomik göstergeleri ağırlıklandırarak hisselerin anlık potansiyelini skorlar. Gerçek zamanlı sinyal üretmek için hisse kodunu girin.
          </p>
          <form onSubmit={handleCalculate} className="space-y-4">
            <Input 
              label="Hisse Kodu Girin" 
              placeholder="Örn: THYAO" 
              value={calcTicker}
              onChange={(e) => setCalcTicker(e.target.value)}
              className="uppercase"
            />
            <Button type="submit" loading={calcLoading} className="w-full">
              Sinyal Hesapla
            </Button>
          </form>

          {calcResult && (
            <div className="mt-8 p-4 bg-[#1a2141] rounded-lg border border-[#00d4ff]/30 animate-in zoom-in-95">
              <h3 className="font-bold text-center mb-3">Sonuç: {calcResult.ticker}</h3>
              <div className="flex justify-center mb-4">
                <SignalBadge signal={calcResult.signal} />
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-gray-400">Total Skor:</span>
                <span className="font-bold text-white">{calcResult.score}/100</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-gray-400">Temel Puan:</span>
                <span className="text-white">{calcResult.fundScore}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-gray-400">Teknik Puan:</span>
                <span className="text-white">{calcResult.techScore}</span>
              </div>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2 overflow-hidden p-0 border-[rgba(255,255,255,0.05)] flex flex-col">
          <div className="p-4 border-b border-[rgba(255,255,255,0.05)] bg-[#10152e] flex items-center justify-between">
            <h2 className="font-bold text-lg">Son Üretilen Sinyaller</h2>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
              <input 
                type="text" 
                placeholder="Hisse ara..." 
                className="bg-[#0a0e27] border border-gray-700 rounded-full pl-9 pr-4 py-1.5 text-sm outline-none focus:border-[#00d4ff]"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-x-auto">
            {loading ? <LoadingSpinner /> : error ? <ErrorAlert message={error} /> : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1a2141] text-gray-400 text-xs uppercase tracking-wider">
                    <th className="p-4 font-medium">Hisse</th>
                    <th className="p-4 font-medium">Tarih</th>
                    <th className="p-4 font-medium">Fiyat</th>
                    <th className="p-4 font-medium">Skor</th>
                    <th className="p-4 font-medium text-right">Sinyal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(255,255,255,0.05)] text-sm">
                  {signals.length === 0 ? (
                    <tr><td colSpan="5" className="p-8 text-center text-gray-500">Kayıtlı sinyal yok.</td></tr>
                  ) : signals.map((sig, idx) => (
                    <tr key={idx} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                      <td className="p-4 font-bold text-white">{sig.ticker}</td>
                      <td className="p-4 text-gray-400">{formatDate(sig.createdAt)}</td>
                      <td className="p-4 text-gray-300 font-mono">{formatCurrency(sig.price)}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                           <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                             <div className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-green-500" style={{ width: `${Math.min(100, Math.max(0, sig.score))}%` }} />
                           </div>
                           <span className="text-xs text-gray-400 w-6">{sig.score}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <SignalBadge signal={sig.signal} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Signals;
