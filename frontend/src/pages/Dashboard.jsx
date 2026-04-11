import { useState, useEffect } from 'react';
import client from '../api/client';
import { Card } from '../components/ui/Card';
import { LoadingSpinner, ErrorAlert } from '../components/ui/Feedback';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { PriceChart } from '../components/ui/PriceChart';
import { Activity, TrendingUp, AlertTriangle } from 'lucide-react';

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Portfolio özeti çekiliyor
        const portfolioRes = await client.get('/portfolio');
        // Makro sinyaller çekiliyor
        const macroRes = await client.get('/macro');
        
        setData({
          portfolio: portfolioRes.data,
          macros: macroRes.data
        });
      } catch (err) {
        setError('Gösterge paneli verileri yüklenirken hata oluştu.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) return <LoadingSpinner text="Piyasa verileri yükleniyor..." />;
  if (error) return <ErrorAlert message={error} />;

  const { portfolio, macros } = data;
  const isProfit = portfolio.summary.totalPL >= 0;

  // Mock data for the sparkline chart
  const mockChartLabels = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const mockChartData = [10000, 10200, 10150, 10500, 10800, 10750, portfolio.summary.totalValue || 11000];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h1 className="text-3xl font-bold flex items-center gap-3">
        <Activity className="text-[#00d4ff]" /> Panoroma (Dashboard)
      </h1>
      
      {/* Portföy Özeti Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2 relative overflow-hidden">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-gray-400 font-medium mb-1">Toplam Portföy Değeri</h3>
              <p className="text-4xl font-bold text-white">
                {formatCurrency(portfolio.summary.totalValue || 0)}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-bold ${isProfit ? 'bg-[#00ff88]/10 text-[#00ff88]' : 'bg-[#ff4757]/10 text-[#ff4757]'}`}>
              {isProfit ? '+' : ''}{formatPercent(portfolio.summary.totalPLPercent || 0)}
            </div>
          </div>
          
          <div className="h-[200px] w-full mt-4">
            <PriceChart 
              labels={mockChartLabels} 
              data={mockChartData} 
              color={isProfit ? '#00ff88' : '#00d4ff'} 
            />
          </div>
        </Card>
        
        <div className="space-y-6 flex flex-col">
          <Card className="flex-1 bg-gradient-to-br from-[#1a2141] to-[#0a0e27]">
            <h3 className="text-gray-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis">Gösterge: CDS (Türkiye)</h3>
            <p className="text-3xl font-bold mt-3 text-white">
              {macros.find(m => m.type === 'CDS')?.value || 'N/A'} <span className="text-sm font-normal text-gray-500">bps</span>
            </p>
          </Card>
          <Card className="flex-1 bg-gradient-to-br from-[#1a2141] to-[#0a0e27]">
            <h3 className="text-gray-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis">Gösterge: VIX (Korku Endeksi)</h3>
            <p className="text-3xl font-bold mt-3 text-[#ffaa00]">
              {macros.find(m => m.type === 'VIX')?.value || 'N/A'}
            </p>
          </Card>
        </div>
      </div>

      {/* Portfolio Quick List */}
      <h2 className="text-xl font-bold mt-8 mb-4">Varlık Dağılımı</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {portfolio.items.length === 0 ? (
          <div className="col-span-4 p-8 text-center text-gray-500 glass-panel rounded-xl border border-dashed border-gray-600">
            Henüz hisse eklemediniz. Portföy sayfasına giderek varlık eklemeye başlayın.
          </div>
        ) : (
          portfolio.items.map((item) => (
            <Card key={item.ticker} className="p-4 flex justify-between items-center hover:bg-[#1e2644] transition-colors cursor-pointer border-l-4 border-l-[#00d4ff]">
              <div>
                <p className="font-bold text-lg">{item.ticker}</p>
                <p className="text-xs text-gray-400">{item.shares} Adet</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(item.currentPrice)}</p>
                <p className={`text-sm ${item.pl >= 0 ? 'text-[#00ff88]' : 'text-[#ff4757]'}`}>
                  {item.pl >= 0 ? '+' : ''}{formatPercent(item.plPercent)}
                </p>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Sinyaller */}
      <h2 className="text-xl font-bold mt-8 mb-4">Robotik Sinyaller (Demo)</h2>
      <Card>
        <div className="flex items-center gap-4 p-4 text-amber-400 bg-amber-400/10 rounded-lg border border-amber-400/20">
          <AlertTriangle />
          <p>Sinyal algoritması gece yarısı kapanışlarıyla güncellenir. Tam liste için menüden "Sinyaller" sekmesine göz atın.</p>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
