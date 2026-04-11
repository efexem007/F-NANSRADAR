import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { TrendingUp, TrendingDown, DollarSign, BarChart2, Activity, PieChart } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const StatCard = ({ title, value, subtitle, icon: Icon, color, trend }) => (
  <div className={`glass-card stat-card ${color}`}>
    <div className="flex items-start justify-between mb-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{title}</p>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}/10`}>
        <Icon size={18} className={`text-${color}`} />
      </div>
    </div>
    <p className="text-2xl font-bold mb-1">{value}</p>
    {subtitle && <p className={`text-xs font-medium ${trend >= 0 ? 'text-green' : 'text-red'}`}>{subtitle}</p>}
  </div>
);

const STOCK_COLORS = {
  THYAO: '#22c55e',
  AKBNK: '#a855f7',
  TUPRS: '#f59e0b',
  ASELS: '#ec4899',
};

const Dashboard = () => {
  const [portfolio, setPortfolio] = useState({ items: [], summary: {} });
  const [macros, setMacros] = useState([]);
  const [signals, setSignals] = useState([]);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('Tümü');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [portRes, macroRes, sigRes] = await Promise.all([
          client.get('/portfolio'),
          client.get('/macro'),
          client.get('/signal/history'),
        ]);
        setPortfolio(portRes.data);
        setMacros(macroRes.data);
        setSignals(sigRes.data);

        // Fetch price data for each stock in portfolio
        const tickers = ['THYAO', 'AKBNK', 'TUPRS', 'ASELS'];
        const priceData = {};
        for (const ticker of tickers) {
          try {
            const res = await client.get(`/stock/${ticker}/price?period=3mo`);
            priceData[ticker] = res.data.priceData || [];
          } catch { priceData[ticker] = []; }
        }
        setPrices(priceData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const { summary } = portfolio;
  const isProfit = (summary.totalPL || 0) >= 0;
  const cds = macros.find(m => m.type === 'CDS');
  const vix = macros.find(m => m.type === 'VIX');

  // Build multi-line chart data
  const lineChartData = useMemo(() => {
    const tickers = Object.keys(prices).filter(t => prices[t].length > 0);
    if (tickers.length === 0) return null;
    const labels = (prices[tickers[0]] || []).map((p, i) => {
      const d = new Date(p.date);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });

    return {
      labels,
      datasets: tickers.map(ticker => ({
        label: ticker,
        data: prices[ticker].map(p => p.close),
        borderColor: STOCK_COLORS[ticker] || '#00d4ff',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.4,
      })),
    };
  }, [prices]);

  // Build bar chart – monthly change simulation
  const barChartData = useMemo(() => {
    const labels = ['Ock', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const data = labels.map(() => (Math.random() - 0.4) * 12);
    return {
      labels,
      datasets: [{
        label: 'Aylık Değişim %',
        data,
        backgroundColor: data.map(v => v >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
        borderRadius: 4,
        barThickness: 18,
      }],
    };
  }, []);

  const lineOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { color: '#94a3b8', usePointStyle: true, pointStyle: 'circle', padding: 20, font: { size: 12 } } },
      tooltip: { backgroundColor: '#1e293b', titleColor: '#94a3b8', bodyColor: '#f1f5f9', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12, displayColors: true },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#475569', font: { size: 11 } } },
      y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#475569', font: { size: 11 } } },
    },
    interaction: { intersect: false, mode: 'index' },
  };

  const barOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#1e293b', titleColor: '#94a3b8', bodyColor: '#f1f5f9', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12 },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#475569', font: { size: 11 } } },
      y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#475569', font: { size: 11 } } },
    },
  };

  const stockFilters = ['Tümü', 'THYAO', 'AKBNK', 'TUPRS', 'ASELS'];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-text-muted text-sm">Piyasa verileri yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Title + Filter Pills */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity size={24} className="text-accent" />
            FinansRadar <span className="text-gradient">Dashboard</span>
          </h1>
          <p className="text-sm text-text-muted mt-1">BIST Performans & Sinyal Analizi</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {stockFilters.map(f => (
            <button key={f} className={`pill ${activeFilter === f ? 'active' : ''}`} onClick={() => setActiveFilter(f)}>
              {f !== 'Tümü' && <span className="w-2 h-2 rounded-full" style={{ background: STOCK_COLORS[f] }}></span>}
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Toplam Portföy Değeri"
          value={formatCurrency(summary.totalValue || 0)}
          subtitle={`${isProfit ? '+' : ''}${formatPercent(summary.totalPLPercent || 0)} toplam getiri`}
          icon={DollarSign} color="blue" trend={summary.totalPLPercent}
        />
        <StatCard
          title="Toplam K/Z"
          value={formatCurrency(summary.totalPL || 0)}
          subtitle={isProfit ? 'Kârdasınız 🚀' : 'Zararda ⚠️'}
          icon={isProfit ? TrendingUp : TrendingDown} color={isProfit ? 'green' : 'red'} trend={summary.totalPL}
        />
        <StatCard
          title="CDS (Türkiye Riski)"
          value={`${cds?.value || '-'} bps`}
          subtitle="5 Yıllık CDS Spread"
          icon={BarChart2} color="amber" trend={-1}
        />
        <StatCard
          title="VIX (Korku Endeksi)"
          value={vix?.value || '-'}
          subtitle="Piyasa Volatilitesi"
          icon={Activity} color="red" trend={-1}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Line Chart */}
        <div className="glass-card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <BarChart2 size={16} className="text-accent" />
              Aylık Performans Çizgi Grafiği
            </h2>
            <span className="text-[11px] font-semibold text-accent bg-accent/10 px-2.5 py-1 rounded-full">3 AY</span>
          </div>
          <div className="h-[320px]">
            {lineChartData ? <Line data={lineChartData} options={lineOptions} /> : <p className="text-text-muted text-center pt-20">Veri bulunamadı</p>}
          </div>
        </div>

        {/* Bar Chart */}
        <div className="glass-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <BarChart2 size={16} className="text-green" />
              Aylık Artış / Azalış
            </h2>
          </div>
          <div className="h-[320px]">
            <Bar data={barChartData} options={barOptions} />
          </div>
        </div>
      </div>

      {/* Portfolio Holdings */}
      <div className="glass-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <PieChart size={16} className="text-purple" />
            Portföy Varlıkları
          </h2>
          <Link to="/portfolio" className="text-xs text-accent hover:underline">Tümünü Gör →</Link>
        </div>

        {portfolio.items.length === 0 ? (
          <div className="text-center py-10 text-text-muted">
            <PieChart size={32} className="mx-auto mb-3 opacity-30" />
            <p>Henüz portföyünüzde varlık bulunmuyor.</p>
            <Link to="/portfolio" className="text-accent text-sm mt-2 inline-block hover:underline">Hisse Ekle →</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th>Hisse</th>
                  <th className="text-right">Adet</th>
                  <th className="text-right">Ort. Maliyet</th>
                  <th className="text-right">Güncel Fiyat</th>
                  <th className="text-right">K/Z</th>
                  <th className="text-right">Sinyal</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.items.map((item) => {
                  const sig = signals.find(s => s.ticker === item.ticker);
                  return (
                    <tr key={item.ticker}>
                      <td>
                        <Link to={`/stock/${item.ticker}`} className="flex items-center gap-2 hover:text-accent transition-colors">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: STOCK_COLORS[item.ticker] || '#00d4ff' }}></span>
                          <span className="font-semibold">{item.ticker}</span>
                        </Link>
                      </td>
                      <td className="text-right font-mono text-text-secondary">{item.shares}</td>
                      <td className="text-right font-mono text-text-secondary">{formatCurrency(item.avgCost)}</td>
                      <td className="text-right font-mono">{formatCurrency(item.currentPrice)}</td>
                      <td className={`text-right font-mono font-semibold ${(item.pl || 0) >= 0 ? 'text-green' : 'text-red'}`}>
                        {(item.pl || 0) >= 0 ? '+' : ''}{formatCurrency(item.pl || 0)}
                      </td>
                      <td className="text-right">
                        {sig ? (
                          <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                            sig.signal?.includes('AL') ? 'bg-green/10 text-green' : sig.signal?.includes('SAT') ? 'bg-red/10 text-red' : 'bg-yellow/10 text-yellow'
                          }`}>{sig.signal}</span>
                        ) : <span className="text-text-muted text-xs">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
