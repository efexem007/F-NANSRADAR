import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import { Card } from '../components/ui/Card';
import { LoadingSpinner, ErrorAlert } from '../components/ui/Feedback';
import { PriceChart } from '../components/ui/PriceChart';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { Activity, Target, BarChart2 } from 'lucide-react';

const StockDetail = () => {
  const { ticker } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('3mo');

  useEffect(() => {
    fetchStockData();
  }, [ticker, period]);

  const fetchStockData = async () => {
    try {
      setLoading(true);
      const [fundRes, priceRes] = await Promise.all([
        client.get(`/stock/${ticker}/fundamental`),
        client.get(`/stock/${ticker}/price?period=${period}`)
      ]);
      setData({ fund: fundRes.data, price: priceRes.data });
    } catch (err) {
      setError('Hisse verileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const RatioRow = ({ label, value }) => (
    <div className="flex justify-between items-center py-2 border-b border-[rgba(255,255,255,0.05)] text-sm px-1">
      <span className="text-gray-400">{label}</span>
      <span className="font-bold text-white">{value !== null && value !== undefined ? value : '-'}</span>
    </div>
  );

  if (loading && !data) return <LoadingSpinner text="Hisse analizi yükleniyor..." />;
  if (error) return <div className="p-4"><ErrorAlert message={error} /></div>;
  if (!data || !data.fund) return <div className="p-8 text-center text-gray-500">Kayıt Bulunamadı</div>;

  const { fund, price } = data;
  const ratios = fund.ratios || {};
  const currentPrice = price.currentPrice;

  // Format chart data
  const chartLabels = price.priceData?.map(p => new Date(p.date).toLocaleDateString('tr-TR')) || [];
  const chartValues = price.priceData?.map(p => p.close) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Activity size={32} className="text-[#00d4ff]" />
          <span className="bg-[#1a2141] px-3 py-1 rounded-lg border border-[#00d4ff] text-white">
            {ticker}
          </span> 
          Analizi
        </h1>
        <div className="text-right">
          <p className="text-sm text-gray-400">Güncel Fiyat</p>
          <p className="text-3xl font-bold text-white">{formatCurrency(currentPrice)}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fiyat Grafiği */}
        <Card className="lg:col-span-2 min-h-[400px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
              <BarChart2 size={18}/> Fiyat Grafiği Yörüngesi
            </h2>
            <div className="flex gap-2">
              {['1mo', '3mo', '6mo', '1y'].map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`text-xs font-bold px-3 py-1 rounded-full border transition-colors ${
                    period === p ? 'bg-[#00d4ff]/10 text-[#00d4ff] border-[#00d4ff]' : 'border-gray-700 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 w-full relative min-h-[300px]">
            {loading ? <LoadingSpinner /> : (
               <PriceChart labels={chartLabels} data={chartValues} color="#9b51e0" />
            )}
          </div>
        </Card>
        
        {/* Temel Oranlar & Göstergeler */}
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold mb-4 text-gray-300 flex items-center gap-2">
              <Target size={18} className="text-[#00ff88]" /> Finansal Çarpanlar
            </h2>
            <div className="space-y-1">
              <RatioRow label="F/K" value={ratios.fk} />
              <RatioRow label="PD/DD" value={ratios.pddd} />
              <RatioRow label="Cari Oran" value={ratios.currentRatio} />
              <RatioRow label="Asit Test" value={ratios.acidTest} />
              <RatioRow label="Net Marj (%)" value={ratios.netMargin} />
              <RatioRow label="Kaldıraç" value={ratios.leverage} />
              <RatioRow label="Net Borç/FAVÖK" value={ratios.nfbToEbitda} />
            </div>
            {fund.fundamental?.length > 0 && (
              <p className="text-xs text-gray-500 text-right mt-3">
                * {fund.fundamental[0].period} bilançosuna göre
              </p>
            )}
          </Card>
          
          <Card className="bg-gradient-to-br from-[#1a2141] to-[#0a0e27]">
            <h2 className="text-lg font-semibold mb-2 text-white">Pratik Sinyal Gönderimi</h2>
            <p className="text-sm text-gray-400 mb-4">Bu hisse için Sinyal sayfasında bir hesaplama başlatın ya da Backtest simülatöründe geçmiş yıllardaki performansını ölçün.</p>
            <div className="flex gap-2">
               <a href="/signals" className="flex-1 text-center bg-[#00d4ff]/20 text-[#00d4ff] hover:bg-[#00d4ff]/30 py-2 rounded font-medium transition-colors text-sm">Sinyallere Git</a>
               <a href="/backtest" className="flex-1 text-center bg-[#9b51e0]/20 text-[#9b51e0] hover:bg-[#9b51e0]/30 py-2 rounded font-medium transition-colors text-sm">Simüle Et</a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StockDetail;
