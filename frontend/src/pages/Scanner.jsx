
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
import AssetRow from '../components/scanner/AssetRow';

// ═══════════════════════════════════════════════════════════════════════════
// MARKETS CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const MARKETS = [
  { key: 'all', label: 'Tüm BIST', icon: '🌍', color: 'from-purple-500 to-cyan-500' },
  { key: 'bist', label: 'Hisseler', icon: '🏛️', color: 'from-red-500 to-orange-500' },
  { key: 'index', label: 'Endeksler', icon: '📊', color: 'from-violet-500 to-purple-500' },
];

import { SIGNAL_COLORS } from '../constants/colors';

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
  // v6.0-F-NANSRADAR Gelistirme: Improved state persistence
  const [scanning, setScanning] = useState(() => {
    try { return localStorage.getItem('scanInProgress') === 'true'; } catch { return false; }
  });
  const [scanProgress, setScanProgress] = useState(() => {
    try { 
      const s = localStorage.getItem('scanProgress');
      return s ? JSON.parse(s) : { current: 0, total: 0, text: '' };
    } catch { return { current: 0, total: 0, text: '' }; }
  });
  const [scanResults, setScanResults] = useState(() => {
    try { 
      const s = localStorage.getItem('lastScanResults');
      const scanTime = localStorage.getItem('lastScanTime');
      if (s && scanTime) {
        const data = JSON.parse(s);
        // Eğer tarama 1 saatten eskiyse geçersiz say
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        if (new Date(scanTime).getTime() > oneHourAgo) {
          return data;
        }
      }
      return null;
    } catch { return null; }
  });
  const [aiPicks, setAiPicks] = useState(() => {
    try { 
      const s = localStorage.getItem('lastAiPicks');
      const scanTime = localStorage.getItem('lastScanTime');
      if (s && scanTime) {
        const data = JSON.parse(s);
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        if (new Date(scanTime).getTime() > oneHourAgo) {
          return data;
        }
      }
      return null;
    } catch { return null; }
  });
  const [watchlist, setWatchlist] = useState([]);
  const [wlLoading, setWlLoading] = useState(false);
  const [sortBy, setSortBy] = useState('opportunityScore');
  const [sortDir, setSortDir] = useState('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [quickTicker, setQuickTicker] = useState('');
  const [view, setView] = useState('scanner');
  const [selectedTickers, setSelectedTickers] = useState([]);
  // ═══ FILTER STATES (Alışveriş Uygulaması Tarzı Chip Filtreleri) ═══
  const [timeFrame, setTimeFrame] = useState('1D');
  const [signalFilters, setSignalFilters] = useState([]); // ['GÜÇLÜ AL', 'AL', ...]
  const [riskFilters, setRiskFilters] = useState([]); // ['Düşük', 'Orta', ...]
  const [returnFilters, setReturnFilters] = useState([]); // ['0-10', '10-25', ...]
  const [minScore, setMinScore] = useState(0); // 0, 30, 50, 60, 70, 80
  const [showFilters, setShowFilters] = useState(false);
  const activeFilterCount = signalFilters.length + riskFilters.length + returnFilters.length + (minScore > 0 ? 1 : 0);

  // v6.0-F-NANSRADAR Gelistirme: State persistence effects
  useEffect(() => {
    if (scanning) {
      localStorage.setItem('scanInProgress', 'true');
    } else {
      localStorage.removeItem('scanInProgress');
    }
  }, [scanning]);

  useEffect(() => {
    if (scanProgress.current > 0) {
      localStorage.setItem('scanProgress', JSON.stringify(scanProgress));
    }
  }, [scanProgress]);

  useEffect(() => {
    if (scanResults?.scanTime) {
      localStorage.setItem('lastScanResults', JSON.stringify(scanResults));
      localStorage.setItem('lastScanTime', scanResults.scanTime);
    }
  }, [scanResults]);

  useEffect(() => {
    if (aiPicks) {
      localStorage.setItem('lastAiPicks', JSON.stringify(aiPicks));
    }
  }, [aiPicks]);

  // v6.0-F-NANSRADAR Gelistirme: Debounce for search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce delay

    return () => clearTimeout(timer);
  }, [searchQuery]);

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
  const cleanupEventSource = React.useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Component unmount olduğunda EventSource'u temizle
  React.useEffect(() => {
    return () => {
      cleanupEventSource();
    };
  }, [cleanupEventSource]);

  // Scan market (Real-time Streaming)
  const handleScan = React.useCallback((marketOrSymbols = activeMarket) => {
    // Önceki bağlantıyı temizle
    cleanupEventSource();
    toast.dismiss();

    const isCustomList = Array.isArray(marketOrSymbols);
    const symbolsParam = isCustomList ? `&symbols=${marketOrSymbols.join(',')}` : `&market=${marketOrSymbols}`;
    
    // Filtre parametreleri
    const filterParams = `&timeFrame=${timeFrame}`;

    setScanning(true);
    toast.loading(`${isCustomList ? `${marketOrSymbols.length} Seçili Varlık` : marketOrSymbols === 'all' ? 'Tüm piyasalar' : marketOrSymbols.toUpperCase()} taranıyor...`, { id: 'scan-toast' });
    
    // Yeni tarama başlatıldığında eski sonuçları sıfırla (S4 fix)
    setScanResults({ totalScanned: 0, totalPassed: 0, results: [], totalErrors: 0, scanTime: null });
    setScanProgress({ current: 0, total: 0, text: 'Başlatılıyor...' });

    const token = localStorage.getItem('token') || '';
    const eventSource = new EventSource(`/api/universal/scan-stream?token=${token}${symbolsParam}${filterParams}`);
    eventSourceRef.current = eventSource;

    // Event handler'ları tanımla
    const handleProgress = (event) => {
      const { current, total, text } = JSON.parse(event.data);
      setScanProgress({ current, total, text: text || `${current}/${total} tarandı` });
      toast.loading(`Taranıyor... ${current}/${total}`, { id: 'scan-toast' });
    };

    const handleAssetAnalyzed = (event) => {
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
    };

    const handleAssetSkipped = (event) => {
      const { symbol, reason } = JSON.parse(event.data);
      console.warn(`[Tara] Atlandı: ${symbol} — ${reason}`);
      setScanResults(prev => ({
        ...prev,
        totalErrors: (prev?.totalErrors || 0) + 1
      }));
    };

    const handleDone = (event) => {
      cleanupEventSource();
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
    };

    const handleError = (event) => {
      if (eventSource.readyState === EventSource.CLOSED) return;
      if (eventSource.readyState === EventSource.CONNECTING) return;
      cleanupEventSource();
      setScanning(false);
      toast.error('Ağ bağlantısı kesildi. Lütfen tekrar deneyin.', { id: 'scan-toast' });
    };

    // Event listener'ları ekle
    eventSource.addEventListener('progress', handleProgress);
    eventSource.addEventListener('assetAnalyzed', handleAssetAnalyzed);
    eventSource.addEventListener('assetSkipped', handleAssetSkipped);
    eventSource.addEventListener('done', handleDone);
    eventSource.addEventListener('error', handleError);

    // Cleanup fonksiyonu
    return () => {
      eventSource.removeEventListener('progress', handleProgress);
      eventSource.removeEventListener('assetAnalyzed', handleAssetAnalyzed);
      eventSource.removeEventListener('assetSkipped', handleAssetSkipped);
      eventSource.removeEventListener('done', handleDone);
      eventSource.removeEventListener('error', handleError);
    };
  }, [activeMarket, timeFrame, cleanupEventSource]);

  // Quick Scan — tek sembol tarama (scope bug fix)
  const handleQuickScan = async () => {
    if (!quickTicker) {
      toast.error('Lütfen bir sembol girin');
      return;
    }
    
    const ticker = quickTicker.trim().toUpperCase();
    if (ticker.length < 2 || ticker.length > 10) {
      toast.error('Geçersiz sembol formatı (2-10 karakter)');
      return;
    }
    
    setScanning(true);
    const toastId = toast.loading(`${ticker} taranıyor...`);
    let abortTimer = null;
    
    try {
      let market = 'bist';
      if (ticker.includes('=')) market = 'forex';
      else if (ticker.includes('-')) market = 'crypto';
      
      const controller = new AbortController();
      abortTimer = setTimeout(() => controller.abort(), 30000);
      
      const { data } = await client.get(`/universal/scan/${ticker}?type=${market}`, {
        signal: controller.signal
      });
      
      clearTimeout(abortTimer);
      abortTimer = null;
      
      if (!data || !data.symbol) {
        throw new Error('Geçersiz API yanıtı');
      }
      
      // Mevcut sonuçlara ekle (üzerine yaz değil)
      setScanResults(prev => {
        const prevResults = prev?.results || [];
        const existingIdx = prevResults.findIndex(r => r.symbol === data.symbol);
        let newResults;
        if (existingIdx >= 0) {
          newResults = [...prevResults];
          newResults[existingIdx] = data;
        } else {
          newResults = [...prevResults, data];
        }
        const finalResults = {
          totalScanned: (prev?.totalScanned || 0) + 1,
          totalPassed: newResults.length,
          totalErrors: prev?.totalErrors || 0,
          results: newResults,
          scanTime: new Date().toISOString()
        };
        const newPicks = generateLocalAIPicks(finalResults);
        setAiPicks(newPicks);
        localStorage.setItem('lastScanResults', JSON.stringify(finalResults));
        localStorage.setItem('lastAiPicks', JSON.stringify(newPicks));
        return finalResults;
      });
      
      toast.dismiss(toastId);
      toast.success(`${ticker} taraması tamamlandı!`);
      
    } catch (err) {
      if (abortTimer) clearTimeout(abortTimer);
      toast.dismiss(toastId);
      
      let errorMessage = 'Tarama başarısız oldu';
      if (err.name === 'AbortError') {
        errorMessage = 'Tarama zaman aşımına uğradı (30 saniye)';
      } else if (err.response?.status === 404) {
        errorMessage = `Sembol bulunamadı: ${ticker}`;
      } else if (err.response?.status === 400) {
        errorMessage = 'Geçersiz sembol formatı';
      } else if (err.response?.status === 429) {
        errorMessage = 'Çok fazla istek, lütfen bekleyin';
      } else if (err.response?.status >= 500) {
        errorMessage = 'Sunucu hatası, lütfen daha sonra deneyin';
      } else if (!navigator.onLine) {
        errorMessage = 'İnternet bağlantınız yok';
      }
      
      toast.error(errorMessage);
      console.error('Quick scan error:', err);
    } finally {
      setScanning(false);
      setQuickTicker('');
    }
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

  // ═══ CHIP FILTER TOGGLE HELPERS ═══
  const toggleChip = (arr, setArr, value) => {
    setArr(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  };
  const clearAllFilters = () => {
    setSignalFilters([]);
    setRiskFilters([]);
    setReturnFilters([]);
    setMinScore(0);
  };

  // ═══ RETURN RANGE MATCHER ═══
  const matchReturnRange = (annualReturn, range) => {
    if (annualReturn == null) return false;
    switch(range) {
      case 'negative': return annualReturn < 0;
      case '0-10': return annualReturn >= 0 && annualReturn < 10;
      case '10-25': return annualReturn >= 10 && annualReturn < 25;
      case '25-50': return annualReturn >= 25 && annualReturn < 50;
      case '50+': return annualReturn >= 50;
      default: return true;
    }
  };

  // ═══ DISPLAY RESULTS (with chip filters) ═══
  const displayResults = useMemo(() => {
    if (!scanResults?.results) return [];
    if (scanResults.results.length === 0) return [];
    
    let items = scanResults.results;
    
    // Market filter
    if (activeMarket !== 'all') {
      items = items.filter(i => i.type === activeMarket);
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i => 
        i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)
      );
    }

    // Signal filter (chip)
    if (signalFilters.length > 0) {
      items = items.filter(i => signalFilters.includes(i.signal));
    }

    // Risk level filter (chip)
    if (riskFilters.length > 0) {
      items = items.filter(i => riskFilters.includes(i.riskLevel));
    }

    // Return expectation filter (chip)
    if (returnFilters.length > 0) {
      items = items.filter(i => returnFilters.some(range => matchReturnRange(i.estimatedAnnualReturn, range)));
    }

    // Min opportunity score filter
    if (minScore > 0) {
      items = items.filter(i => i.opportunityScore >= minScore);
    }

    // Sort
    if (items.length > 0) {
      const sorted = [...items];
      sorted.sort((a, b) => {
        const valA = a[sortBy] ?? 0;
        const valB = b[sortBy] ?? 0;
        return sortDir === 'desc' ? valB - valA : valA - valB;
      });
      return sorted;
    }

    return items;
  }, [scanResults, activeMarket, searchQuery, sortBy, sortDir, signalFilters, riskFilters, returnFilters, minScore]);

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

      {/* ═══ SCANNER PROGRESS BAR ═══ */}
      {view !== 'lab' && (scanning || scanProgress.total > 0) && (
        <div className="glass-card p-4 animate-fade-in border border-purple-500/20 mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {scanning ? (
                <div className="relative w-4 h-4">
                  <div className="w-4 h-4 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                </div>
              ) : (
                <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                  <span className="text-[8px] text-white font-bold">✓</span>
                </div>
              )}
              <span className="text-xs font-bold text-white">
                {scanning ? 'Tarama Devam Ediyor...' : '✅ Tarama Tamamlandı'}
              </span>
              {scanResults?.totalErrors > 0 && (
                <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  {scanResults.totalErrors} hata atlandı
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="font-mono text-slate-400">
                {scanProgress.current}<span className="text-slate-600">/</span>{scanProgress.total}
              </span>
              <span className="font-mono font-bold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full text-[11px]">
                {scanProgress.total > 0 ? Math.round((scanProgress.current / scanProgress.total) * 100) : 0}%
              </span>
            </div>
          </div>

          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${scanProgress.total > 0 ? Math.min(100, Math.round((scanProgress.current / scanProgress.total) * 100)) : 0}%`,
                background: scanning
                  ? 'linear-gradient(90deg, #8b5cf6, #06b6d4, #8b5cf6)'
                  : 'linear-gradient(90deg, #10b981, #22c55e)',
                backgroundSize: scanning ? '200% 100%' : '100% 100%',
              }}
            />
          </div>

          {scanProgress.text && (
            <p className="text-[11px] text-slate-400 truncate font-mono">
              {scanProgress.text}
            </p>
          )}
        </div>
      )}

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
                      ? "bg-gradient-to-r " + m.color + " text-white shadow-lg"
                      : "bg-white/3 text-slate-400 hover:bg-white/5 hover:text-white"
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

          {/* ═══ FILTER BAR — Alışveriş Uygulaması Tarzı ═══ */}
          <div className="space-y-2">
            {/* Filter Header Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Zaman Dilimi Chips */}
                <div className="flex gap-1">
                  {[
                    { key: '1H', label: '1 Saat' },
                    { key: '4H', label: '4 Saat' },
                    { key: '1D', label: '1 Gün' },
                    { key: '1W', label: '1 Hafta' },
                    { key: '1M', label: '1 Ay' },
                    { key: '3M', label: '3 Ay' },
                    { key: '6M', label: '6 Ay' },
                    { key: '1Y', label: '1 Yıl' },
                  ].map(tf => (
                    <button
                      key={tf.key}
                      onClick={() => setTimeFrame(tf.key)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-full transition-all border ${
                        timeFrame === tf.key
                          ? 'bg-purple-500/25 text-purple-200 border-purple-500/50 shadow-md shadow-purple-900/20'
                          : 'bg-white/4 text-slate-400 border-transparent hover:text-white hover:bg-white/8 hover:border-white/10'
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowFilters(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                  showFilters || activeFilterCount > 0
                    ? 'bg-purple-500/20 text-purple-200 border-purple-500/40'
                    : 'bg-white/4 text-slate-400 border-transparent hover:text-white hover:bg-white/8'
                }`}
              >
                <Filter size={13} />
                Filtreler
                {activeFilterCount > 0 && (
                  <span className="ml-0.5 bg-purple-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{activeFilterCount}</span>
                )}
              </button>
            </div>

            {/* Expanded Filter Chips Panel */}
            {showFilters && (
              <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-4 space-y-4 animate-fade-in">
                {/* Sinyal Filtresi */}
                <div>
                  <div className="text-[11px] text-slate-500 font-semibold mb-2 flex items-center gap-1.5">
                    <Zap size={11} className="text-amber-400" /> Sinyal
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['GÜÇLÜ AL', 'AL', 'BEKLE', 'SAT', 'GÜÇLÜ SAT'].map(sig => {
                      const active = signalFilters.includes(sig);
                      const sc = SIGNAL_COLORS[sig] || {};
                      return (
                        <button
                          key={sig}
                          onClick={() => toggleChip(signalFilters, setSignalFilters, sig)}
                          className={`px-3 py-1.5 text-[11px] font-bold rounded-full transition-all border ${
                            active
                              ? `${sc.bg} ${sc.text} ${sc.border}`
                              : 'bg-white/4 text-slate-400 border-transparent hover:bg-white/8'
                          }`}
                        >
                          {sig}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Risk Seviyesi */}
                <div>
                  <div className="text-[11px] text-slate-500 font-semibold mb-2 flex items-center gap-1.5">
                    <ShieldCheck size={11} className="text-cyan-400" /> Risk Seviyesi
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: 'Düşük', icon: '🟢', activeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
                      { key: 'Orta', icon: '🟡', activeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
                      { key: 'Yüksek', icon: '🟠', activeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
                      { key: 'Çok Yüksek', icon: '🔴', activeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
                    ].map(r => {
                      const active = riskFilters.includes(r.key);
                      return (
                        <button
                          key={r.key}
                          onClick={() => toggleChip(riskFilters, setRiskFilters, r.key)}
                          className={`px-3 py-1.5 text-[11px] font-semibold rounded-full transition-all border flex items-center gap-1.5 ${
                            active
                              ? r.activeClass
                              : 'bg-white/4 text-slate-400 border-transparent hover:bg-white/8'
                          }`}
                        >
                          <span className="text-xs">{r.icon}</span> {r.key}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Getiri Beklentisi */}
                <div>
                  <div className="text-[11px] text-slate-500 font-semibold mb-2 flex items-center gap-1.5">
                    <TrendingUp size={11} className="text-emerald-400" /> Tahmini Yıllık Getiri
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: 'negative', label: '📉 Negatif', activeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
                      { key: '0-10', label: '%0–10', activeClass: 'bg-slate-500/20 text-slate-300 border-slate-500/40' },
                      { key: '10-25', label: '%10–25', activeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
                      { key: '25-50', label: '%25–50', activeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
                      { key: '50+', label: '%50+', activeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
                    ].map(ret => {
                      const active = returnFilters.includes(ret.key);
                      return (
                        <button
                          key={ret.key}
                          onClick={() => toggleChip(returnFilters, setReturnFilters, ret.key)}
                          className={`px-3 py-1.5 text-[11px] font-semibold rounded-full transition-all border ${
                            active
                              ? ret.activeClass
                              : 'bg-white/4 text-slate-400 border-transparent hover:bg-white/8'
                          }`}
                        >
                          {ret.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Min Fırsat Skoru */}
                <div>
                  <div className="text-[11px] text-slate-500 font-semibold mb-2 flex items-center gap-1.5">
                    <Target size={11} className="text-purple-400" /> Minimum Fırsat Skoru
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[0, 30, 50, 60, 70, 80].map(sc => (
                      <button
                        key={sc}
                        onClick={() => setMinScore(sc)}
                        className={`px-3 py-1.5 text-[11px] font-semibold rounded-full transition-all border ${
                          minScore === sc
                            ? 'bg-purple-500/25 text-purple-200 border-purple-500/50'
                            : 'bg-white/4 text-slate-400 border-transparent hover:bg-white/8'
                        }`}
                      >
                        {sc === 0 ? 'Hepsi' : `${sc}+`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filtreleri Temizle */}
                {activeFilterCount > 0 && (
                  <div className="pt-2 border-t border-white/5">
                    <button
                      onClick={clearAllFilters}
                      className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      <X size={12} /> Tüm Filtreleri Temizle ({activeFilterCount})
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Active Filter Tags (collapsed view) */}
            {!showFilters && activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] text-slate-500 mr-1">Aktif:</span>
                {signalFilters.map(sf => (
                  <span key={sf} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${SIGNAL_COLORS[sf]?.bg} ${SIGNAL_COLORS[sf]?.text} ${SIGNAL_COLORS[sf]?.border} border`}>
                    {sf}
                    <X size={10} className="cursor-pointer opacity-60 hover:opacity-100" onClick={() => toggleChip(signalFilters, setSignalFilters, sf)} />
                  </span>
                ))}
                {riskFilters.map(rf => (
                  <span key={rf} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    Risk: {rf}
                    <X size={10} className="cursor-pointer opacity-60 hover:opacity-100" onClick={() => toggleChip(riskFilters, setRiskFilters, rf)} />
                  </span>
                ))}
                {returnFilters.map(rf => (
                  <span key={rf} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    Getiri: {rf === 'negative' ? 'Negatif' : `%${rf}`}
                    <X size={10} className="cursor-pointer opacity-60 hover:opacity-100" onClick={() => toggleChip(returnFilters, setReturnFilters, rf)} />
                  </span>
                ))}
                {minScore > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    Skor: {minScore}+
                    <X size={10} className="cursor-pointer opacity-60 hover:opacity-100" onClick={() => setMinScore(0)} />
                  </span>
                )}
                <button onClick={clearAllFilters} className="text-[10px] text-rose-400 hover:text-rose-300 ml-1">
                  Temizle
                </button>
              </div>
            )}
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
