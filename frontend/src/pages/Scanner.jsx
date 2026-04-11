import React, { useState, useEffect } from 'react';
import client from '../api/client';
import toast from 'react-hot-toast';
import { Search, Play, RefreshCw, Layers } from 'lucide-react';
import ChartCard from '../components/ChartCard';

export default function Scanner() {
  const [scanning, setScanning] = useState(false);
  const [ticker, setTicker] = useState('');
  const [results, setResults] = useState([]);
  const [detailModal, setDetailModal] = useState(null);

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      const { data } = await client.get('/scan/results');
      setResults(data);
    } catch (err) {
      toast.error('Sonuçlar alınamadı');
    }
  };

  const handleScanSingle = async () => {
    if (!ticker) return toast.error('Hisse kodu girin');
    setScanning(true);
    const loadingToast = toast.loading(`${ticker.toUpperCase()} taranıyor...`);
    try {
      const { data } = await client.post(`/scan/stock/${ticker.toUpperCase()}`);
      toast.success(`${ticker.toUpperCase()} tarandı: ${data.signal}`, { id: loadingToast });
      setTicker('');
      fetchResults();
    } catch (err) {
      toast.error('Tarama hatası', { id: loadingToast });
    } finally {
      setScanning(false);
    }
  };

  const handleScanAll = async () => {
    setScanning(true);
    try {
      await client.post('/scan/all');
      toast.success('Toplu tarama arka planda başlatıldı! Kısa süre sonra sonuçlar düşmeye başlayacak.', { duration: 5000 });
      // Poll for 3 times every 5 sec
      let count = 0;
      const interval = setInterval(() => {
        fetchResults();
        count++;
        if (count >= 3) clearInterval(interval);
      }, 5000);
    } catch (err) {
      toast.error('Hata oluştu');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
          <Search className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-xl font-bold text-white">AI Scanner v4.0</div>
          <div className="text-xs text-slate-400 -mt-0.5">Teknik, Temel, Makro ve Risk Harmanlı Tam Tarama Motoru</div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-5">
          <ChartCard icon="🎯" title="Tarama Kontrol Paneli" badge="CANLI">
            <div className="flex flex-col gap-4 mt-2">
              <p className="text-sm text-slate-400">Veritabanındaki BIST hisselerini kapsamlı bir taramadan geçirerek sinyalleri yakalayın.</p>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Hisse Kodu (Örn: GARAN)"
                  value={ticker}
                  onChange={e => setTicker(e.target.value.toUpperCase())}
                  className="input-field flex-1 uppercase"
                />
                <button
                  onClick={handleScanSingle}
                  disabled={scanning}
                  className="btn-primary"
                >
                  {scanning ? <RefreshCw className="animate-spin" size={18} /> : <Search size={18} />} Tara
                </button>
              </div>

              <div className="h-px bg-white/5 my-2"></div>

              <button
                onClick={handleScanAll}
                disabled={scanning}
                className="w-full py-3 rounded-xl font-bold flex gap-2 justify-center items-center transition-all disabled:opacity-50
                           bg-gradient-to-r from-purple-600/30 to-cyan-600/30 border border-purple-500/50 text-purple-300 hover:text-white hover:border-purple-400"
              >
                {scanning ? <RefreshCw className="animate-spin" size={18} /> : <Layers size={18} />} 
                Tüm Veritabanını Tara (Toplu Analiz)
              </button>
            </div>
          </ChartCard>
          
          <div className="mt-6 glass-card p-5">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><Play className="text-cyan-400 w-4 h-4"/> Otomatik Zamanlanmış Taramalar</h3>
            <p className="text-xs text-slate-400 mb-2">Sistem her gün aşağıdaki saatlerde arka planda tüm hisseleri otomatik olarak tarar:</p>
            <ul className="text-sm text-slate-300 space-y-1 ml-4 list-disc">
              <li>09:00 (Piyasa Açılış Öncesi)</li>
              <li>13:00 (Öğle Arası Kontrolü)</li>
              <li>18:00 (Gün Sonu Kapanış Özeti)</li>
            </ul>
          </div>
        </div>

        <div className="col-span-12 md:col-span-7">
          <ChartCard icon="📊" title="Son Tarama Sonuçları">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full data-table">
                <thead className="sticky top-0 bg-[#12122a] z-10 shadow-md">
                  <tr>
                    <th>Hisse</th>
                    <th>Sanal Zeka Sinyali</th>
                    <th className="text-center">Skor</th>
                    <th className="text-right">Son Fiyat</th>
                    <th className="text-right">Tarama Saati</th>
                  </tr>
                </thead>
                <tbody>
                  {results.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center py-8 text-slate-500">Henüz taranmış hisse bulunmuyor.</td>
                    </tr>
                  ) : (
                    results.map(r => (
                      <tr key={r.id} onClick={() => setDetailModal(r)} className="cursor-pointer hover:bg-white/5 transition-colors">
                        <td className="font-bold text-slate-200">{r.ticker}</td>
                        <td className={`font-semibold 
                          ${r.signal.includes('GÜÇLÜ AL') ? 'text-emerald-400' : 
                            r.signal.includes('AL') ? 'text-green-400' : 
                            r.signal.includes('SAT') ? 'text-red-400' : 
                            'text-amber-400'}`}>
                          {r.signal}
                        </td>
                        <td className="text-center">
                          <span className={`px-2 py-0.5 rounded text-xs
                            ${r.score >= 70 ? 'bg-emerald-500/20 text-emerald-400' :
                              r.score <= 30 ? 'bg-red-500/20 text-red-400' :
                              'bg-white/10 text-slate-300'}`}>
                            {r.score}
                          </span>
                        </td>
                        <td className="text-right font-mono">₺{(r.price || 0).toFixed(2)}</td>
                        <td className="text-right text-xs text-slate-500">{new Date(r.createdAt).toLocaleTimeString('tr-TR')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </div>
      </div>

      {/* Algoritma Detay Modalı */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass-card w-full max-w-md p-6 relative">
            <button onClick={() => setDetailModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">✕</button>
            <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent mb-1">{detailModal.ticker} Algoritma Röntkeni</h2>
            <div className={`text-sm font-semibold mb-5 
              ${detailModal.signal.includes('GÜÇLÜ AL') ? 'text-emerald-400' : 
                detailModal.signal.includes('AL') ? 'text-green-400' : 
                detailModal.signal.includes('SAT') ? 'text-red-400' : 
                'text-amber-400'}`}>
              Nihai Karar: {detailModal.signal} (Toplam Skor: {detailModal.score})
            </div>
            
            <div className="space-y-4">
              {(() => {
                let d = null;
                try { d = JSON.parse(detailModal.details); } catch(e) {}
                if (!d) return <div className="text-slate-400 text-sm italic border border-white/10 p-3 rounded-lg">Bu sinyal için geçmiş metrik detayı bulunmuyor.</div>;
                
                return [
                  { label: 'Teknik Analiz (MACD, RSI, BB)', val: d.techScore, color: 'bg-purple-500', weight: '35%' },
                  { label: 'Temel Analiz (Rasyolar)', val: d.fundScore, color: 'bg-cyan-500', weight: '25%' },
                  { label: 'Makro Ekonomi (CDS, VIX)', val: d.macroScoreVal, color: 'bg-blue-500', weight: '20%' },
                  { label: 'Sentiment (Haber Duygusu)', val: d.haberPuan, color: 'bg-emerald-500', weight: '10%' },
                  { label: 'Risk ve Volatilite Kalkanı', val: d.riskScore, color: 'bg-amber-500', weight: '10%' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${item.color}`}></span>
                        {item.label} <span className="text-slate-500 text-[10px] ml-1">(Ağırlık: {item.weight})</span>
                      </span>
                      <span className="text-white font-bold">{item.val} / 100</span>
                    </div>
                    <div className="h-2 w-full bg-[#0d0d1a] border border-white/5 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${Math.max(0, Math.min(100, item.val))}%` }}></div>
                    </div>
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
