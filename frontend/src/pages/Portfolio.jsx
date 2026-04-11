import { useState, useEffect } from 'react';
import client from '../api/client';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { PieChart, Plus, Trash2, TrendingUp, TrendingDown, DollarSign, BarChart2 } from 'lucide-react';

const Portfolio = () => {
  const [data, setData] = useState({ items: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [ticker, setTicker] = useState('');
  const [shares, setShares] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => { fetchPortfolio(); }, []);

  const fetchPortfolio = async () => {
    try {
      setLoading(true);
      const res = await client.get('/portfolio');
      setData(res.data);
    } catch { setError('Portföy verisi alınamadı.'); }
    finally { setLoading(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalLoading(true);
    try {
      await client.post('/portfolio/add', { ticker: ticker.toUpperCase(), shares: parseFloat(shares), avgCost: parseFloat(avgCost) });
      setShowModal(false); setTicker(''); setShares(''); setAvgCost('');
      fetchPortfolio();
    } catch (err) { setModalError(err.response?.data?.error || 'Eklenemedi.'); }
    finally { setModalLoading(false); }
  };

  const handleDelete = async (t) => {
    if (!window.confirm(`${t} portföyden çıkarılsın mı?`)) return;
    try { await client.delete(`/portfolio/${t}`); fetchPortfolio(); } catch { alert('Silinemedi.'); }
  };

  const { summary } = data;
  const isProfit = (summary.totalPL || 0) >= 0;

  if (loading && data.items.length === 0) {
    return <div className="flex items-center justify-center h-[60vh]"><div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><PieChart size={24} className="text-purple" /> Portföy Yönetimi</h1>
          <p className="text-sm text-text-muted mt-1">Varlıklarınızı yönetin ve performansı takip edin</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={16} /> Hisse Ekle</button>
      </div>

      {error && <div className="bg-red/10 border border-red/20 text-red text-sm p-3 rounded-lg">{error}</div>}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card stat-card blue">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">Toplam Maliyet</p>
          <p className="text-2xl font-bold">{formatCurrency(summary.totalCost || 0)}</p>
        </div>
        <div className="glass-card stat-card green">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">Güncel Değer</p>
          <p className="text-2xl font-bold text-accent">{formatCurrency(summary.totalValue || 0)}</p>
        </div>
        <div className={`glass-card stat-card ${isProfit ? 'green' : 'red'}`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">Toplam K/Z</p>
          <p className={`text-2xl font-bold ${isProfit ? 'text-green' : 'text-red'}`}>{formatCurrency(summary.totalPL || 0)}</p>
        </div>
        <div className={`glass-card stat-card ${isProfit ? 'green' : 'red'}`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">K/Z Oranı</p>
          <p className={`text-2xl font-bold ${isProfit ? 'text-green' : 'text-red'}`}>{isProfit ? '+' : ''}{formatPercent(summary.totalPLPercent || 0)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full data-table">
            <thead><tr className="bg-bg-card">
              <th>Hisse</th><th className="text-right">Adet</th><th className="text-right">Ort. Maliyet</th>
              <th className="text-right">Güncel Fiyat</th><th className="text-right">Toplam Değer</th>
              <th className="text-right">K/Z</th><th className="text-center">İşlem</th>
            </tr></thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-10 text-text-muted">Portföyde hisse yok. "Hisse Ekle" butonuyla başlayın.</td></tr>
              ) : data.items.map((item) => (
                <tr key={item.ticker}>
                  <td><span className="font-semibold text-accent">{item.ticker}</span></td>
                  <td className="text-right font-mono text-text-secondary">{item.shares}</td>
                  <td className="text-right font-mono text-text-secondary">{formatCurrency(item.avgCost)}</td>
                  <td className="text-right font-mono">{formatCurrency(item.currentPrice)}</td>
                  <td className="text-right font-mono">{formatCurrency(item.value)}</td>
                  <td className={`text-right font-mono font-semibold ${(item.pl||0) >= 0 ? 'text-green' : 'text-red'}`}>
                    <div>{(item.pl||0) >= 0 ? '+' : ''}{formatCurrency(item.pl||0)}</div>
                    <div className="text-[11px] opacity-70">{(item.pl||0) >= 0 ? '+' : ''}{formatPercent(item.plPercent||0)}</div>
                  </td>
                  <td className="text-center">
                    <button onClick={() => handleDelete(item.ticker)} className="text-text-muted hover:text-red transition-colors p-1.5 rounded-lg hover:bg-red/10">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative glass-card w-full max-w-md neon-glow">
            <h2 className="text-lg font-bold mb-4">Yeni Hisse Ekle</h2>
            {modalError && <div className="bg-red/10 text-red text-sm p-2 rounded-lg mb-3">{modalError}</div>}
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block uppercase tracking-wider">Hisse Kodu</label>
                <input value={ticker} onChange={(e) => setTicker(e.target.value)} required placeholder="THYAO" className="input-field uppercase" maxLength={10} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-secondary mb-1.5 block uppercase tracking-wider">Adet</label>
                  <input type="number" step="any" min="0.01" value={shares} onChange={(e) => setShares(e.target.value)} required className="input-field" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-secondary mb-1.5 block uppercase tracking-wider">Ort. Maliyet (₺)</label>
                  <input type="number" step="any" min="0.01" value={avgCost} onChange={(e) => setAvgCost(e.target.value)} required className="input-field" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline flex-1">İptal</button>
                <button type="submit" disabled={modalLoading} className="btn-primary flex-1">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Portfolio;
