import { useState, useEffect } from 'react';
import client from '../api/client';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { LoadingSpinner, ErrorAlert } from '../components/ui/Feedback';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { PieChart, Plus, Trash2 } from 'lucide-react';

const Portfolio = () => {
  const [data, setData] = useState({ items: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ticker, setTicker] = useState('');
  const [shares, setShares] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const fetchPortfolio = async () => {
    try {
      setLoading(true);
      const res = await client.get('/portfolio');
      setData(res.data);
    } catch (err) {
      setError('Portföy verisi alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStock = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalLoading(true);
    
    try {
      if (!ticker || !shares || !avgCost) {
         throw new Error("Lütfen tüm alanları doldurun.");
      }
      await client.post('/portfolio/add', {
        ticker: ticker.toUpperCase(),
        shares: parseFloat(shares),
        avgCost: parseFloat(avgCost)
      });
      setIsModalOpen(false);
      setTicker(''); setShares(''); setAvgCost('');
      fetchPortfolio(); // Refresh data
    } catch (err) {
      setModalError(err.response?.data?.error || err.message || 'Ürün eklenemedi.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (tickerToDelete) => {
    if (!window.confirm(`${tickerToDelete} hissesini portföyden çıkarmak istediğinize emin misiniz?`)) return;
    
    try {
      await client.delete(`/portfolio/${tickerToDelete}`);
      fetchPortfolio();
    } catch (err) {
      alert("Silme işlemi başarısız oldu.");
    }
  };

  if (loading && data.items.length === 0) return <LoadingSpinner />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <PieChart className="text-[#00d4ff]" size={32} />
          Portföy Yönetimi
        </h1>
        <Button className="gap-2" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Hisse Ekle
        </Button>
      </div>

      <ErrorAlert message={error} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <p className="text-sm text-gray-400 font-medium">Toplam Maliyet</p>
          <p className="text-2xl font-bold mt-1 text-white">{formatCurrency(data.summary.totalCost || 0)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-400 font-medium">Güncel Değer</p>
          <p className="text-2xl font-bold mt-1 text-[#00d4ff]">{formatCurrency(data.summary.totalValue || 0)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-400 font-medium">Toplam K/Z</p>
          <p className={`text-2xl font-bold mt-1 ${(data.summary.totalPL || 0) >= 0 ? 'text-[#00ff88]' : 'text-[#ff4757]'}`}>
            {formatCurrency(data.summary.totalPL || 0)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-400 font-medium">Toplam K/Z (%)</p>
          <p className={`text-2xl font-bold mt-1 ${(data.summary.totalPLPercent || 0) >= 0 ? 'text-[#00ff88]' : 'text-[#ff4757]'}`}>
            {(data.summary.totalPLPercent || 0) > 0 ? '+' : ''}{formatPercent(data.summary.totalPLPercent || 0)}
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden p-0 border-[rgba(255,255,255,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#1a2141] text-gray-400 text-sm border-b border-[rgba(255,255,255,0.05)]">
                <th className="p-4 font-medium uppercase tracking-wider">Hisse</th>
                <th className="p-4 font-medium text-right uppercase tracking-wider">Adet</th>
                <th className="p-4 font-medium text-right uppercase tracking-wider">Ort. Maliyet</th>
                <th className="p-4 font-medium text-right uppercase tracking-wider">Güncel Fiyat</th>
                <th className="p-4 font-medium text-right uppercase tracking-wider">Toplam Değer</th>
                <th className="p-4 font-medium text-right uppercase tracking-wider">K/Z</th>
                <th className="p-4 font-medium text-center uppercase tracking-wider">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.05)] text-sm">
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-gray-500">
                    Portföyünüzde henüz hisse bulunmuyor. Eklemek için "Hisse Ekle" butonunu kullanın.
                  </td>
                </tr>
              ) : (
                data.items.map((item) => (
                  <tr key={item.ticker} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors group">
                    <td className="p-4">
                       <span className="font-bold text-white bg-[#1a2141] px-2 py-1 rounded border border-[rgba(0,212,255,0.3)]">{item.ticker}</span>
                    </td>
                    <td className="p-4 text-right text-gray-300 font-mono">{item.shares}</td>
                    <td className="p-4 text-right text-gray-300 font-mono">{formatCurrency(item.avgCost)}</td>
                    <td className="p-4 text-right text-white font-mono">{formatCurrency(item.currentPrice)}</td>
                    <td className="p-4 text-right font-medium text-white font-mono">{formatCurrency(item.value)}</td>
                    <td className={`p-4 text-right font-bold font-mono ${item.pl >= 0 ? 'text-[#00ff88]' : 'text-[#ff4757]'}`}>
                      <div>{item.pl >= 0 ? '+' : ''}{formatCurrency(item.pl)}</div>
                      <div className="text-xs opacity-80 font-normal">{item.pl >= 0 ? '+' : ''}{formatPercent(item.plPercent)}</div>
                    </td>
                    <td className="p-4 text-center">
                      <button 
                         onClick={() => handleDelete(item.ticker)}
                         className="text-gray-500 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-500/10"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Yeni Hisse Ekle">
        <ErrorAlert message={modalError} />
        <form onSubmit={handleAddStock} className="space-y-4">
          <Input 
            label="Hisse Kodu (Örn: THYAO)" 
            value={ticker} 
            onChange={(e) => setTicker(e.target.value)} 
            required 
            placeholder="THYAO"
            className="uppercase"
            maxLength={10}
          />
          <div className="grid grid-cols-2 gap-4">
             <Input 
               label="Adet" 
               type="number" 
               step="any"
               min="0.01"
               value={shares} 
               onChange={(e) => setShares(e.target.value)} 
               required 
             />
             <Input 
               label="Ortalama Maliyet (₺)" 
               type="number"
               step="any" 
               min="0.01"
               value={avgCost} 
               onChange={(e) => setAvgCost(e.target.value)} 
               required 
             />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>İptal</Button>
            <Button type="submit" loading={modalLoading}>Kaydet</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

export default Portfolio;
