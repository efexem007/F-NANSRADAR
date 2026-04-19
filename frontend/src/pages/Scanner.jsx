import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import toast from 'react-hot-toast';
import {
  Search, RefreshCw, Zap, TrendingUp, TrendingDown, ChevronDown, ChevronRight,
  Star, StarOff, Eye, ArrowUpRight, ArrowDownRight, Filter, Globe, BarChart2,
  Layers, Target, ShieldCheck, AlertTriangle, Plus, X, Clock, Cpu, Trash2
} from 'lucide-react';
import ChartCard from '../components/ChartCard';
import Backtest from './Backtest';

// ═══════════════════════════════════════════════════════════════════════════
// MARKETS CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const MARKETS = [
  { key: 'all', label: 'Tüm BIST', icon: '🌍', color: 'from-purple-500 to-cyan-500' },
  { key: 'bist', label: 'Hisseler', icon: '🏛️', color: 'from-red-500 to-orange-500' },
  { key: 'index', label: 'Endeksler', icon: '📊', color: 'from-violet-500 to-purple-500' },
];

const SIGNAL_COLORS = {
  'GÜÇLÜ AL': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'AL': { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30' },
  'BEKLE': { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  'SAT': { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  'GÜÇLÜ SAT': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function ScoreBar({ score, label, color = 'bg-purple-500' }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-300 font-mono">{score}</span>
      </div>
      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
      </div>
    </div>
  );
}

function ChangeBadge({ value, small = false }) {
  if (value == null) return null;
  const positive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono font-bold ${small ? 'text-[10px]' : 'text-xs'} ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
      {positive ? <ArrowUpRight size={small ? 10 : 12} /> : <ArrowDownRight size={small ? 10 : 12} />}
      {positive ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
}

function formatPrice(price, type) {
  if (price == null) return '—';
  if (type === 'crypto' && price > 100) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (type === 'crypto') return `$${price.toFixed(2)}`;
  if (type === 'forex') return price.toFixed(4);
  if (type === 'commodity') return `$${price.toFixed(2)}`;
  return `₺${price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// ASSET ROW
// ═══════════════════════════════════════════════════════════════════════════

function AssetRow({ asset, onWatch, isWatched, onNavigate, isSelected, onSelect }) {
  const sc = SIGNAL_COLORS[asset.signal] || SIGNAL_COLORS['BEKLE'];

  return (
    <tr
      className={`group cursor-pointer hover:bg-white/3 transition-colors border-b border-white/3 ${isSelected ? 'bg-purple-500/5' : ''}`}
      onClick={() => onNavigate(asset)}
    >
      {/* Checkbox */}
      <td className="py-2.5 px-2" onClick={(e) => e.stopPropagation()}>
        <input 
          type="checkbox" 
          checked={isSelected}
          onChange={() => onSelect(asset.symbol)}
          className="w-3.5 h-3.5 rounded border-white/10 bg-white/5 text-purple-600 focus:ring-offset-0 focus:ring-purple-500"
        />
      </td>

      {/* Symbol + Name */}
      <td className="py-2.5 px-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">{asset.flag}</span>
          <div>
            <div className="text-xs font-bold text-white">{asset.symbol.replace('.IS','').replace('=X','').replace('-USD','')}</div>
            <div className="text-[10px] text-slate-500 truncate max-w-[120px]">{asset.name}</div>
          </div>
        </div>
      </td>

      {/* Price */}
      <td className="py-2.5 px-2 text-right">
        <div className="text-xs font-mono font-bold text-white">{formatPrice(asset.currentPrice, asset.type)}</div>
      </td>

      {/* Change 1D */}
      <td className="py-2.5 px-2 text-right">
        <ChangeBadge value={asset.change1d} small />
      </td>

      {/* Change 7D */}
      <td className="py-2.5 px-2 text-right hidden md:table-cell">
        <ChangeBadge value={asset.change7d} small />
      </td>

      {/* Signal */}
      <td className="py-2.5 px-2 text-center">
        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${sc.bg} ${sc.text} ${sc.border}`}>
          {asset.signal}
        </span>
      </td>

      {/* Score */}
      <td className="py-2.5 px-2 text-center hidden lg:table-cell">
        <div className="flex items-center justify-center gap-1">
          <div className="w-10 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${asset.opportunityScore}%`,
                background: asset.opportunityScore >= 70 ? '#22c55e' : asset.opportunityScore >= 50 ? '#eab308' : '#ef4444'
              }}
            />
          </div>
          <span className="text-xs font-mono text-slate-300 w-6">{asset.opportunityScore}</span>
        </div>
      </td>

      {/* RSI */}
      <td className="py-2.5 px-2 text-center hidden xl:table-cell">
        <span className={`text-[10px] font-mono ${
          asset.indicators?.rsi < 30 ? 'text-emerald-400' :
          asset.indicators?.rsi > 70 ? 'text-rose-400' : 'text-slate-400'
        }`}>
          {asset.indicators?.rsi ?? '—'}
        </span>
      </td>

      {/* Volatility */}
      <td className="py-2.5 px-2 text-center hidden xl:table-cell">
        <span className="text-[10px] font-mono text-slate-400">{asset.volatility ? `%${asset.volatility}` : '—'}</span>
      </td>

      {/* Watch */}
      <td className="py-2.5 px-2 text-center">
        <button
          onClick={(e) => { e.stopPropagation(); onWatch(asset); }}
          className="p-1 rounded-md hover:bg-white/5 transition-colors"
        >
          {isWatched ? <Star size={14} className="text-amber-400 fill-amber-400" /> : <StarOff size={14} className="text-slate-600 hover:text-amber-400" />}
        </button>
      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AI PICKS CARD
// ═══════════════════════════════════════════════════════════════════════════

function AIPicksCard({ picks, onNavigate }) {
  const [category, setCategory] = useState('topOverall');
  if (!picks) return null;

  const categories = [
    { key: 'topOverall', label: '🏆 Top 5', items: picks.topOverall },
    { key: 'momentum', label: '🚀 Momentum', items: picks.momentum },
    { key: 'oversold', label: '💎 Aşırı Satım', items: picks.oversold },
    { key: 'lowRisk', label: '🛡️ Düşük Risk', items: picks.lowRisk },
  ];

  const active = categories.find(c => c.key === category) || categories[0];

  return (
    <ChartCard icon="🤖" title="AI Seçimleri" badge="YAPAY ZEKA" badgeColor="ai">
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={`text-[10px] px-2.5 py-1 rounded-lg transition-all font-semibold ${
              category === cat.key
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-500 hover:text-slate-300 border border-transparent'
            }`}
          >
            {cat.label} ({cat.items?.length || 0})
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        {(active.items || []).slice(0, 5).map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-white/3 cursor-pointer transition-colors"
            onClick={() => onNavigate(item)}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 w-4">#{idx + 1}</span>
              <span className="text-sm">{item.flag}</span>
              <div>
                <div className="text-xs font-bold text-white">{item.symbol.replace('.IS','').replace('=X','')}</div>
                <div className="text-[10px] text-slate-500">{item.name}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ChangeBadge value={item.change7d} small />
              <span className="text-xs font-mono font-bold text-purple-300">{item.opportunityScore}</span>
            </div>
          </div>
        ))}
        {(!active.items || active.items.length === 0) && (
          <div className="text-center py-4 text-xs text-slate-500">Bu kategoride henüz sonuç yok.</div>
        )}
      </div>
    </ChartCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WATCHLIST PANEL
// ═══════════════════════════════════════════════════════════════════════════

function WatchlistPanel({ watchlist, loading, onRemove, onNavigate }) {
  if (loading) return <div className="text-center py-8 text-slate-500 text-xs">Yükleniyor...</div>;

  return (
    <ChartCard icon="⭐" title="Takip Listen" badge={`${watchlist.length} VARLIK`} badgeColor="amber">
      {watchlist.length === 0 ? (
        <div className="text-center py-6">
          <Star size={32} className="text-slate-700 mx-auto mb-2" />
          <div className="text-sm text-slate-500">Henüz varlık eklenmemiş</div>
          <div className="text-[10px] text-slate-600 mt-1">Tarama sonuçlarından ⭐ ile ekleyebilirsin</div>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
          {watchlist.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white/2 hover:bg-white/4 transition-colors">
              <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => onNavigate(item)}>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    {item.symbol.replace('.IS','').replace('=X','')}
                    {item.live && (
                      <span className={`text-[10px] font-mono ${item.live.change1d >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {item.live.change1d >= 0 ? '+' : ''}{item.live.change1d}%
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500">{item.name}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {item.live && (
                  <span className="text-xs font-mono text-slate-300">{item.live.currentPrice?.toFixed(2)}</span>
                )}
                {item.live?.signal && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${SIGNAL_COLORS[item.live.signal]?.bg || ''} ${SIGNAL_COLORS[item.live.signal]?.text || ''}`}>
                    {item.live.signal}
                  </span>
                )}
                <button onClick={(e) => { e.stopPropagation(); onRemove(item.symbol); }} className="p-1 hover:bg-red-500/10 rounded">
                  <X size={12} className="text-slate-600 hover:text-rose-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKET SUMMARY BAR
// ═══════════════════════════════════════════════════════════════════════════

function MarketSummaryBar({ results }) {
  if (!results?.length) return null;

  const highlights = [
    results.find(r => r.symbol === 'XU100.IS'),
    results.find(r => r.symbol === 'THYAO.IS'),
    results.find(r => r.symbol === 'AKBNK.IS'),
    results.find(r => r.symbol === 'TUPRS.IS'),
    results.find(r => r.symbol === 'ASELS.IS'),
  ].filter(Boolean);

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
      {highlights.map(item => (
        <div key={item.symbol} className="flex-shrink-0 glass-card px-3 py-2 flex items-center gap-2 min-w-[140px]">
          <span className="text-sm">{item.flag}</span>
          <div>
            <div className="text-[10px] text-slate-500">{item.name}</div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-bold text-white">{formatPrice(item.currentPrice, item.type)}</span>
              <ChangeBadge value={item.change1d} small />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCANNER PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function Scanner() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('scanner'); // 'scanner' vs 'lab'
  const [activeMarket, setActiveMarket] = useState('all');
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState(() => {
    try { const s = localStorage.getItem('lastScanResults'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [aiPicks, setAiPicks] = useState(() => {
    try { const s = localStorage.getItem('lastAiPicks'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [watchlist, setWatchlist] = useState([]);
  const [wlLoading, setWlLoading] = useState(false);
  const [sortBy, setSortBy] = useState('opportunityScore');
  const [sortDir, setSortDir] = useState('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickTicker, setQuickTicker] = useState('');
  const [view, setView] = useState('scanner');
  const [selectedTickers, setSelectedTickers] = useState([]); // Yeni: Seçili semboller state'i

  // Load watchlist on mount
  useEffect(() => {
    loadWatchlist();
  }, []);

  const loadWatchlist = async () => {
    setWlLoading(true);
    try {
      const { data } = await client.get('/universal/watchlist');
      setWatchlist(data);
    } catch { /* ignore */ }
    setWlLoading(false);
  };

  // Tarama geçmişini tamamen sıfırla
  const handleReset = () => {
    // Varsa devam eden taramayı kes
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setScanning(false);
    toast.dismiss(); // Tüm açık bildirimleri zorla kapat

    setScanResults(null);
    setAiPicks(null);
    setSelectedTickers([]);
    localStorage.removeItem('lastScanResults');
    localStorage.removeItem('lastAiPicks');
    toast.success('Tarama ve seçimler temizlendi');
  };

  const cancelScan = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setScanning(false);
    toast.dismiss();
    toast.error('Tarama iptal edildi.', { duration: 3000 });
  };

  const toggleSelect = (ticker) => {
    setSelectedTickers(prev => 
      prev.includes(ticker) ? prev.filter(t => t !== ticker) : [...prev, ticker]
    );
  };

  const toggleSelectAll = (results) => {
    if (selectedTickers.length === results.length) {
      setSelectedTickers([]);
    } else {
      setSelectedTickers(results.map(r => r.symbol));
    }
  };

  const eventSourceRef = React.useRef(null);

  // Scan market (Real-time Streaming)
  const handleScan = (marketOrSymbols = activeMarket) => {
    // Varsa eski bağlantıyı öldür ki çift (hayalet) tarama olmasın
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const isCustomList = Array.isArray(marketOrSymbols);
    const symbolsParam = isCustomList ? `&symbols=${marketOrSymbols.join(',')}` : `&market=${marketOrSymbols}`;

    toast.dismiss(); // Eski takılı kalmış olan ne varsa temizle
    setScanning(true);
    toast.loading(`${isCustomList ? `${marketOrSymbols.length} Seçili Varlık` : marketOrSymbols === 'all' ? 'Tüm piyasalar' : marketOrSymbols.toUpperCase()} taranıyor...`, { id: 'scan-toast' });
    
    // Geçmiş taramayı SIFIRLAMA, üzerine ekle
    setScanResults(prev => prev || { totalScanned: 0, totalPassed: 0, results: [], totalErrors: 0 });

    const token = localStorage.getItem('token') || '';
    const eventSource = new EventSource(`/api/universal/scan-stream?token=${token}${symbolsParam}`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('progress', (event) => {
      const { current, total, text } = JSON.parse(event.data);
      setScanProgress({ current, total, text: text || `${current}/${total} tarandı` });
      toast.loading(`Taranıyor... ${current}/${total}`, { id: 'scan-toast' });
    });

    eventSource.addEventListener('assetAnalyzed', (event) => {
      const asset = JSON.parse(event.data);
      setScanResults(prev => {
        const prevResults = prev?.results || [];
        const existingIdx = prevResults.findIndex(r => r.symbol === asset.symbol);
        let newResults;
        if (existingIdx >= 0) {
          newResults = [...prevResults];
          newResults[existingIdx] = asset;
        } else {
          newResults = [...prevResults, asset];
        }
        return {
          totalScanned: (prev?.totalScanned || 0) + 1,
          totalPassed: newResults.length,
          results: newResults,
          scanTime: prev?.scanTime
        };
      });
    });

    eventSource.addEventListener('assetSkipped', (event) => {
      const { symbol, reason } = JSON.parse(event.data);
      // Sadece logla, stream'i kesme!
      console.warn(`[Tara] Atlandı: ${symbol} — ${reason}`);
      setScanResults(prev => ({
        ...prev,
        totalErrors: (prev?.totalErrors || 0) + 1
      }));
    });

    eventSource.addEventListener('done', (event) => {
      eventSource.close();
      setScanning(false);
      setScanResults(prev => {
        const finalResults = { ...prev, scanTime: new Date().toISOString() };
        const newPicks = generateLocalAIPicks(finalResults);
        setAiPicks(newPicks);
        localStorage.setItem('lastScanResults', JSON.stringify(finalResults));
        localStorage.setItem('lastAiPicks', JSON.stringify(newPicks));
        toast.success(`Tarama Tamamlandı! ${finalResults.totalPassed || 0} varlık analiz edildi.`, { id: 'scan-toast', duration: 5000 });
        return finalResults;
      });
    });

    eventSource.addEventListener('error', (event) => {
      // SSE 'error' event'i çoğu zaman bağlantı KAPANINCA tetiklenir (bu normal!)
      // Sadece hala OPEN ise gerçek bir hata var demektir
      if (eventSource.readyState === EventSource.CLOSED) {
        // Bağlantı kapandı — zaten done event gelmiş olmalı, bir şey yapma
        return;
      }
      if (eventSource.readyState === EventSource.CONNECTING) {
        // Yeniden bağlanmaya çalışıyor, bekle
        return;
      }
      // Gerçek ağ hatası
      eventSource.close();
      setScanning(false);
      toast.error('Ağ bağlantısı kesildi. Lütfen tekrar deneyin.', { id: 'scan-toast' });
    });
  };

  // Quick single scan
  const handleQuickScan = async () => {
    if (!quickTicker) return;
    setScanning(true);
    toast.loading(`${quickTicker} taranıyor...`);
    try {
      const market = quickTicker.includes('=') ? 'forex' : quickTicker.includes('-') ? 'crypto' : 'bist';
      const { data } = await client.get(`/universal/scan/${quickTicker}?type=${market}`);
      const finalResults = {
        totalScanned: 1,
        totalPassed: 1,
        totalErrors: 0,
        results: [data],
        scanTime: new Date().toISOString()
      };
      setScanResults(finalResults);
      const newPicks = generateLocalAIPicks(finalResults);
      setAiPicks(newPicks);
      localStorage.setItem('lastScanResults', JSON.stringify(finalResults));
      localStorage.setItem('lastAiPicks', JSON.stringify(newPicks));
      toast.dismiss();
      toast.success(`Tarama tamamlandı`);
    } catch (err) {
      toast.dismiss();
      toast.error('Hata: Belki de sembol bulunamadı.');
    }
    setScanning(false);
    setQuickTicker('');
  };

  // Generate AI picks locally from scan results
  function generateLocalAIPicks(data) {
    if (!data?.results) return null;
    const items = data.results;
    return {
      topOverall: items.slice(0, 5),
      topBist: items.filter(i => i.type === 'bist').slice(0, 5),
      momentum: items.filter(i => i.change7d > 3 && i.relativeVolume > 1.2).slice(0, 5),
      oversold: items.filter(i => i.indicators?.rsi != null && i.indicators.rsi < 35).slice(0, 5),
      lowRisk: items.filter(i => i.riskScore > 70).sort((a,b) => b.riskScore - a.riskScore).slice(0, 5),
    };
  }

  // Watchlist toggle
  const toggleWatchlist = async (asset) => {
    const isWatched = watchlist.some(w => w.symbol === asset.symbol);
    if (isWatched) {
      try {
        await client.delete(`/universal/watchlist/${encodeURIComponent(asset.symbol)}`);
        setWatchlist(prev => prev.filter(w => w.symbol !== asset.symbol));
        toast.success(`${asset.symbol} listeden çıkarıldı`);
      } catch { toast.error('Hata'); }
    } else {
      try {
        await client.post('/universal/watchlist', {
          symbol: asset.symbol,
          name: asset.name,
          assetType: asset.type,
        });
        setWatchlist(prev => [...prev, { symbol: asset.symbol, name: asset.name, assetType: asset.type, live: asset }]);
        toast.success(`⭐ ${asset.symbol} listeye eklendi`);
      } catch { toast.error('Hata'); }
    }
  };

  const removeFromWatchlist = async (symbol) => {
    try {
      await client.delete(`/universal/watchlist/${encodeURIComponent(symbol)}`);
      setWatchlist(prev => prev.filter(w => w.symbol !== symbol));
      toast.success('Çıkarıldı');
    } catch { toast.error('Hata'); }
  };

  // Navigate to asset detail
  const navigateToAsset = (asset) => {
    if (asset.type === 'bist' || asset.assetType === 'bist') {
      navigate(`/stock/${asset.symbol.replace('.IS', '')}`);
    } else {
      navigate(`/stock/${encodeURIComponent(asset.symbol)}`);
    }
  };

  // Filtered and sorted results
  const displayResults = useMemo(() => {
    if (!scanResults?.results) return [];
    let items = [...scanResults.results];

    // Market filter
    if (activeMarket !== 'all') {
      items = items.filter(i => i.type === activeMarket);
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i =>
        i.symbol.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q)
      );
    }

    // Sort
    items.sort((a, b) => {
      const valA = a[sortBy] ?? 0;
      const valB = b[sortBy] ?? 0;
      return sortDir === 'desc' ? valB - valA : valA - valB;
    });

    return items;
  }, [scanResults, activeMarket, searchQuery, sortBy, sortDir]);

  const watchedSymbols = new Set(watchlist.map(w => w.symbol));

  return (
    <div className="space-y-5 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold text-white">AI Scanner & Lab v6.0</div>
            <div className="text-xs text-slate-400 -mt-0.5">Toplu Tarama • Takip Listesi • AI Algoritmik Testler</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('scanner')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'scanner' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Search size={14} className="inline mr-1" /> Tarama
          </button>
          <button
            onClick={() => setView('watchlist')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'watchlist' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Star size={14} className="inline mr-1" /> Takip ({watchlist.length})
          </button>
          <button
            onClick={() => setView('lab')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'lab' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Cpu size={14} className="inline mr-1" /> AI Lab
          </button>
        </div>
      </div>

      {/* Market Summary Bar */}
      {view !== 'lab' && scanResults && <MarketSummaryBar results={scanResults.results} />}

      {view === 'lab' ? (
        <Backtest />
      ) : view === 'scanner' ? (
        <>
          {/* Market Tabs + Scan Button */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-1.5 flex-wrap">
              {MARKETS.map(m => (
                <button
                  key={m.key}
                  onClick={() => setActiveMarket(m.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeMarket === m.key
                      ? `bg-gradient-to-r ${m.color} text-white shadow-lg`
                      : 'bg-white/3 text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span>{m.icon}</span> {m.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {/* Temizle butonu — tarama sirasinda da aktif, cunkü cancelScan ile durdurur */}
              <button
                onClick={handleReset}
                className="px-3 py-2 rounded-xl font-bold text-sm transition-all
                           bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                title="Taramayı Durdur ve Temizle"
              >
                <Trash2 size={16} />
              </button>

              {/* Seçili hisseleri tara — sadece tarama yokken görünür */}
              {selectedTickers.length > 0 && !scanning && (
                <button
                  onClick={() => handleScan(selectedTickers)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all
                             bg-gradient-to-r from-amber-600/40 to-orange-600/40 border border-amber-500/50
                             text-amber-200 hover:text-white hover:border-amber-400"
                  title="Sadece seçtiğin hisseleri tara"
                >
                  <Search size={16} />
                  Seçiliyi Tara ({selectedTickers.length})
                </button>
              )}

              {/* Tarama başlamışsa: İptal Et | Başlamamışsa: Piyasayı Tara */}
              {scanning ? (
                <button
                  onClick={cancelScan}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all
                             bg-gradient-to-r from-rose-600/60 to-red-600/60 border border-rose-500/70
                             text-white hover:from-rose-600 hover:to-red-600 shadow-lg shadow-rose-900/30"
                >
                  <RefreshCw size={16} className="animate-spin" />
                  Taramayı Durdur
                </button>
              ) : (
                <button
                  onClick={() => handleScan()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all
                             bg-gradient-to-r from-purple-600/40 to-cyan-600/40 border border-purple-500/50
                             text-purple-200 hover:text-white hover:border-purple-400"
                >
                  <Zap size={16} />
                  Piyasayı Tara
                </button>
              )}
            </div>
          </div>

          {/* Quick Scan + Search */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Sonuçlarda Ara (THYAO, Bitcoin, Altın...)"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/3 border border-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
              />
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Sembol Ekle (THYAO)"
                value={quickTicker}
                onChange={e => setQuickTicker(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleQuickScan()}
                className="w-44 px-3 py-2 rounded-xl bg-white/3 border border-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              />
              <button onClick={handleQuickScan} disabled={scanning} className="px-3 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-bold hover:bg-cyan-500/25 disabled:opacity-50">
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-12 gap-5">
            {/* Full Width Results Table */}
            <div className="col-span-12">
              <ChartCard icon="📋" title="Tarama Sonuçları" badge={displayResults.length > 0 ? `${displayResults.length} VARLIK` : 'BOŞ'}>
                {!scanResults ? (
                  <div className="text-center py-12">
                    <Globe size={48} className="text-slate-700 mx-auto mb-3" />
                    <div className="text-sm text-slate-400 mb-2">Henüz tarama yapılmadı</div>
                    <div className="text-xs text-slate-600 mb-4">Yukarıdaki "Piyasayı Tara" butonuna tıklayarak başlayın</div>
                    <button onClick={() => handleScan()} className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600/30 to-cyan-600/30 border border-purple-500/50 text-purple-300 text-sm font-bold hover:text-white">
                      <Zap size={14} className="inline mr-1" /> Şimdi Tara
                    </button>
                  </div>
                ) : displayResults.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    Filtrelere uygun sonuç bulunamadı.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[600px]">
                    {scanResults?.scanTime && (
                      <div className="text-[11px] text-slate-400 mb-2 pl-2 flex items-center gap-1.5 border-b border-white/5 pb-2 sticky left-0">
                        <Clock size={12} className="text-purple-400" />
                        Sinyal hesaplama tarihi: <strong className="text-white">{new Date(scanResults.scanTime).toLocaleString('tr-TR')}</strong>
                      </div>
                    )}
                    <table className="w-full">
                      <thead className="sticky top-0 bg-[#12122a]/95 backdrop-blur-sm z-10">
                        <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
                          <th className="py-2 px-2 w-8">
                            <input 
                              type="checkbox" 
                              checked={displayResults.length > 0 && selectedTickers.length === displayResults.length}
                              onChange={() => toggleSelectAll(displayResults)}
                              className="w-3.5 h-3.5 rounded border-white/10 bg-white/5 text-purple-600 focus:ring-offset-0 focus:ring-purple-500"
                            />
                          </th>
                          <th className="text-left py-2 px-1 cursor-pointer hover:text-slate-300" onClick={() => { setSortBy('symbol'); setSortDir(d => d === 'desc' ? 'asc' : 'desc'); }}>Varlık</th>
                          <th className="text-right py-2 px-2 cursor-pointer hover:text-slate-300" onClick={() => { setSortBy('currentPrice'); setSortDir(d => d === 'desc' ? 'asc' : 'desc'); }}>Fiyat</th>
                          <th className="text-right py-2 px-2 cursor-pointer hover:text-slate-300" onClick={() => { setSortBy('change1d'); setSortDir(d => d === 'desc' ? 'asc' : 'desc'); }}>1G %</th>
                          <th className="text-right py-2 px-2 hidden md:table-cell cursor-pointer hover:text-slate-300" onClick={() => { setSortBy('change7d'); setSortDir(d => d === 'desc' ? 'asc' : 'desc'); }}>7G %</th>
                          <th className="text-center py-2 px-2">Sinyal</th>
                          <th className="text-center py-2 px-2 hidden lg:table-cell cursor-pointer hover:text-slate-300" onClick={() => { setSortBy('opportunityScore'); setSortDir(d => d === 'desc' ? 'asc' : 'desc'); }}>Skor</th>
                          <th className="text-center py-2 px-2 hidden xl:table-cell cursor-pointer hover:text-slate-300" onClick={() => { setSortBy('indicators.rsi'); setSortDir(d => d === 'desc' ? 'asc' : 'desc'); }}>RSI</th>
                          <th className="text-center py-2 px-2 hidden xl:table-cell">Vol.</th>
                          <th className="text-center py-2 px-2 w-8">⭐</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayResults.map(asset => (
                          <AssetRow
                            key={asset.symbol}
                            asset={asset}
                            isWatched={watchedSymbols.has(asset.symbol)}
                            isSelected={selectedTickers.includes(asset.symbol)}
                            onSelect={toggleSelect}
                            onWatch={toggleWatchlist}
                            onNavigate={navigateToAsset}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Stats Footer */}
                {scanResults && (
                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
                    <div className="flex gap-4">
                      <span>Toplam: {scanResults.totalScanned}</span>
                      <span>Başarılı: {scanResults.totalPassed}</span>
                      <span>Hata: {scanResults.totalErrors}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={10} /> {new Date(scanResults.scanTime).toLocaleTimeString('tr-TR')}
                    </div>
                  </div>
                )}
              </ChartCard>
            </div>
          </div>
        </>
      ) : null}

      {view === 'ai' && (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 md:col-span-8 md:col-start-3">
            <AIPicksCard picks={aiPicks} onNavigate={navigateToAsset} />
            
            {/* Scan Stats */}
            {scanResults && (
              <div className="glass-card p-4 mt-5">
                <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-2"><BarChart2 size={14} className="text-cyan-400" /> Piyasa Dağılımı</h3>
                {MARKETS.filter(m => m.key !== 'all').map(m => {
                  const count = scanResults.results?.filter(r => r.type === m.key).length || 0;
                  const buyCount = scanResults.results?.filter(r => r.type === m.key && (r.signal === 'AL' || r.signal === 'GÜÇLÜ AL')).length || 0;
                  return (
                    <div key={m.key} className="flex items-center justify-between py-1.5 border-b border-white/3 last:border-b-0">
                      <div className="flex items-center gap-2 text-xs text-slate-300">
                        <span>{m.icon}</span>{m.label}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-emerald-400 font-mono">{buyCount} AL</span>
                        <span className="text-[10px] text-slate-500">/ {count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'watchlist' && (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 md:col-span-8 md:col-start-3">
            <ChartCard icon="⭐" title="Takip Listen (Detaylı)" badge={`${watchlist.length} VARLIK`} badgeColor="amber">
              {wlLoading ? (
                <div className="text-center py-8 text-slate-500">Yükleniyor...</div>
              ) : watchlist.length === 0 ? (
                <div className="text-center py-12">
                  <Star size={48} className="text-slate-700 mx-auto mb-3" />
                  <div className="text-sm text-slate-400 mb-2">Takip listen boş</div>
                  <div className="text-xs text-slate-600">Tarama sekmesinden varlık ekleyebilirsin</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {watchlist.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-white/2 border border-white/5 hover:bg-white/4 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigateToAsset(item)}>
                          <Star size={14} className="text-amber-400 fill-amber-400" />
                          <div>
                            <div className="text-sm font-bold text-white">{item.symbol.replace('.IS','').replace('=X','')}</div>
                            <div className="text-[10px] text-slate-500">{item.name} • {item.assetType?.toUpperCase()}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {item.live && (
                            <>
                              <div className="text-right">
                                <div className="text-sm font-mono font-bold text-white">{item.live.currentPrice?.toFixed(2)}</div>
                                <ChangeBadge value={item.live.change1d} small />
                              </div>
                              {item.live.signal && (
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${SIGNAL_COLORS[item.live.signal]?.bg || ''} ${SIGNAL_COLORS[item.live.signal]?.text || ''}`}>
                                  {item.live.signal}
                                </span>
                              )}
                            </>
                          )}
                          <button onClick={() => removeFromWatchlist(item.symbol)} className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors">
                            <X size={14} className="text-slate-600 hover:text-rose-400" />
                          </button>
                        </div>
                      </div>
                      {/* Extra info row */}
                      {item.live && (
                        <div className="mt-2 pt-2 border-t border-white/5 grid grid-cols-4 gap-2 text-[10px]">
                          <div><span className="text-slate-500">RSI:</span> <span className="text-slate-300 font-mono">{item.live.rsi ?? '—'}</span></div>
                          <div><span className="text-slate-500">7G:</span> <ChangeBadge value={item.live.change7d} small /></div>
                          <div><span className="text-slate-500">Skor:</span> <span className="text-slate-300 font-mono">{item.live.opportunityScore}</span></div>
                          <div><span className="text-slate-500">Hedef:</span> <span className="text-slate-300 font-mono">{item.targetPrice ? `${item.targetPrice}` : '—'}</span></div>
                        </div>
                      )}
                      {item.notes && (
                        <div className="mt-1.5 text-[10px] text-slate-500 italic">📝 {item.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
}
