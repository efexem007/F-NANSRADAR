import { useState } from 'react';
import client from '../api/client';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ErrorAlert } from '../components/ui/Feedback';
import { Cpu, PlayCircle, Info } from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/formatters';

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
      setLoading(true);
      setError('');
      setResult(null);
      
      let url = `/backtest/${ticker.toUpperCase()}`;
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const query = params.toString();
      if (query) url += `?${query}`;

      const res = await client.get(url);
      if (res.data.error) {
        setError(res.data.error);
      } else {
        setResult(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Simülasyon sırasında hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Cpu className="text-[#9b51e0]" size={32} />
          Sinyal Simülasyonu (Backtest)
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 border-t-4 border-t-[#9b51e0]">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <PlayCircle className="text-[#9b51e0]" /> Test Parametreleri
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input 
              label="Hisse Kodu Girin" 
              placeholder="Örn: AKBNK" 
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              className="uppercase"
              required
            />
            <div className="space-y-4">
              <Input 
                label="Başlangıç Tarihi (Opsiyonel)" 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Input 
                label="Bitiş Tarihi (Opsiyonel)" 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            
            <Button type="submit" loading={loading} className="w-full bg-[#9b51e0] hover:bg-[#8541c4] focus:ring-[#9b51e0]">
              Simülasyon Başlat
            </Button>
          </form>

          <div className="mt-6 flex gap-3 text-sm p-3 bg-[#1a2141]/50 rounded-lg border border-[rgba(255,255,255,0.05)] text-gray-400">
            <Info size={16} className="shrink-0 mt-0.5 text-[#0d9488]" />
            <p>Backtest motoru, hissenin tarih boyunca aldığı AL-SAT sinyallerini test ederek, başlangıç sermayesi (₺10.000) üzerinden nasıl bir performans göstereceğini hesaplar.</p>
          </div>
        </Card>

        <Card className="lg:col-span-3 min-h-[400px]">
          <h2 className="font-bold text-lg mb-4">Simülasyon Sonuçları</h2>
          <ErrorAlert message={error} />
          
          {!result && !loading && !error && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 border-2 border-dashed border-gray-700 rounded-xl">
              <Cpu size={48} className="mb-4 text-gray-600" />
              <p>Sonuçları görmek için testi başlatın.</p>
            </div>
          )}

          {result && (
            <div className="animate-in zoom-in-95 duration-300">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-[#151a30] p-4 rounded-xl border border-[rgba(255,255,255,0.05)]">
                  <p className="text-gray-400 text-sm mb-1">Final Bakiyesi</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(result.finalCapital)}</p>
                </div>
                <div className="bg-[#151a30] p-4 rounded-xl border border-[rgba(255,255,255,0.05)]">
                  <p className="text-gray-400 text-sm mb-1">Toplam Getiri</p>
                  <p className={`text-2xl font-bold ${result.totalReturnPercent >= 0 ? 'text-[#00ff88]' : 'text-[#ff4757]'}`}>
                    {result.totalReturnPercent >= 0 ? '+' : ''}{formatPercent(result.totalReturnPercent)}
                  </p>
                </div>
                <div className="bg-[#151a30] p-4 rounded-xl border border-[rgba(255,255,255,0.05)]">
                  <p className="text-gray-400 text-sm mb-1">Kazanma Oranı</p>
                  <p className="text-2xl font-bold text-[#00d4ff]">{result.winRate.toFixed(1)}%</p>
                </div>
                <div className="bg-[#151a30] p-4 rounded-xl border border-[rgba(255,255,255,0.05)]">
                  <p className="text-gray-400 text-sm mb-1">Maksimum Düşüş</p>
                  <p className="text-2xl font-bold text-orange-400">-{result.maxDrawdownPercent.toFixed(1)}%</p>
                </div>
              </div>

              <div className="h-[300px] flex items-center justify-center border border-[rgba(255,255,255,0.05)] rounded-lg bg-[#0d122b]">
                 <span className="text-gray-500 text-sm">Buraya detaylı trade listesi ve simülasyon equity (bakiye büyüme) grafiği eklenecek.</span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Backtest;
