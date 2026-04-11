import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler } from 'chart.js';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { Activity, Target, BarChart2, ArrowLeft } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const StockDetail = () => {
  const { ticker } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('3mo');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [fundRes, priceRes] = await Promise.all([
          client.get(`/stock/${ticker}/fundamental`),
          client.get(`/stock/${ticker}/price?period=${period}`)
        ]);
        setData({ fund: fundRes.data, price: priceRes.data });
      } catch { setError('Hisse verileri yüklenemedi.'); }
      finally { setLoading(false); }
    })();
  }, [ticker, period]);

  if (loading && !data) return <div className="flex items-center justify-center h-[60vh]"><div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" /></div>;
  if (error) return <div className="bg-red/10 border border-red/20 text-red text-sm p-4 rounded-lg">{error}</div>;
  if (!data?.fund) return <div className="text-center py-20 text-text-muted">Kayıt bulunamadı</div>;

  const { fund, price } = data;
  const ratios = fund.ratios || {};
  const labels = price.priceData?.map(p => new Date(p.date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })) || [];
  const values = price.priceData?.map(p => p.close) || [];

  const chartData = {
    labels,
    datasets: [{
      fill: true, data: values,
      borderColor: '#a855f7', borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: 0.4,
      backgroundColor: (ctx) => {
        const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 300);
        g.addColorStop(0, 'rgba(168,85,247,0.3)'); g.addColorStop(1, 'rgba(168,85,247,0)');
        return g;
      },
    }],
  };
  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', titleColor: '#94a3b8', bodyColor: '#f1f5f9', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 10 } },
    scales: { x: { grid: { display: false }, ticks: { color: '#475569', font: { size: 10 }, maxTicksLimit: 8 } }, y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#475569', font: { size: 10 } } } },
    interaction: { intersect: false, mode: 'index' },
  };

  const RatioRow = ({ label, value }) => (
    <div className="flex justify-between items-center py-2.5 border-b border-border text-sm">
      <span className="text-text-muted">{label}</span>
      <span className="font-semibold font-mono">{value ?? '—'}</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/portfolio" className="w-8 h-8 rounded-lg bg-bg-card border border-border flex items-center justify-center hover:border-accent transition-colors">
            <ArrowLeft size={16} className="text-text-muted" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity size={24} className="text-purple" />
              <span className="bg-bg-card px-3 py-1 rounded-lg border border-purple/30 text-white font-mono">{ticker}</span>
              Analizi
            </h1>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-muted uppercase tracking-wider">Güncel Fiyat</p>
          <p className="text-3xl font-bold">{formatCurrency(price.currentPrice)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="glass-card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2"><BarChart2 size={16} className="text-purple" /> Fiyat Yörüngesi</h2>
            <div className="flex gap-1.5">
              {['1mo', '3mo', '6mo', '1y'].map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`text-[11px] font-bold px-3 py-1 rounded-full border transition-colors ${period === p ? 'bg-purple/10 text-purple border-purple/30' : 'border-border text-text-muted hover:text-text-secondary'}`}>
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[320px]">{loading ? <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-purple border-t-transparent rounded-full animate-spin" /></div> : <Line data={chartData} options={chartOpts} />}</div>
        </div>

        {/* Ratios */}
        <div className="space-y-4">
          <div className="glass-card">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Target size={16} className="text-green" /> Finansal Çarpanlar</h2>
            <RatioRow label="F/K" value={ratios.fk} />
            <RatioRow label="PD/DD" value={ratios.pddd} />
            <RatioRow label="Cari Oran" value={ratios.currentRatio} />
            <RatioRow label="Asit Test" value={ratios.acidTest} />
            <RatioRow label="Net Marj (%)" value={ratios.netMargin} />
            <RatioRow label="Kaldıraç" value={ratios.leverage} />
            <RatioRow label="Borç/FAVÖK" value={ratios.nfbToEbitda} />
          </div>
          <div className="glass-card bg-gradient-to-br from-bg-card to-bg-primary">
            <h2 className="text-sm font-semibold mb-2">Hızlı Erişim</h2>
            <p className="text-xs text-text-muted mb-3">Bu hisse için sinyal hesapla veya geçmişi simüle et.</p>
            <div className="flex gap-2">
              <Link to="/signals" className="flex-1 text-center bg-accent/10 text-accent hover:bg-accent/20 py-2 rounded-lg font-semibold text-xs transition-colors">Sinyaller</Link>
              <Link to="/backtest" className="flex-1 text-center bg-purple/10 text-purple hover:bg-purple/20 py-2 rounded-lg font-semibold text-xs transition-colors">Simüle Et</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockDetail;
