import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../api/client'
import { formatCurrency, formatDate } from '../utils/formatters'
import {
  TrendingUp, RefreshCw, Activity, Search, Zap, ExternalLink,
  Play, StopCircle, CheckCircle2, AlertTriangle, BarChart3
} from 'lucide-react'

const SIGNAL_STYLES = {
  'GÜÇLÜ AL': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  'GUCLU AL': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  'AL':       'bg-green-500/15 text-green-300 border-green-500/30',
  'BEKLE':    'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'SAT':      'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'GÜÇLÜ SAT':'bg-red-500/20 text-red-300 border-red-500/40',
  'GUCLU SAT':'bg-red-500/20 text-red-300 border-red-500/40',
}

const SIGNAL_ORDER = { 'GÜÇLÜ AL': 1, 'GUCLU AL': 1, 'AL': 2, 'BEKLE': 3, 'SAT': 4, 'GÜÇLÜ SAT': 5, 'GUCLU SAT': 5 }

const Signals = () => {
  const navigate = useNavigate()
  const [signals, setSignals] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSignal, setFilterSignal] = useState('all')
  const [sortBy, setSortBy] = useState('score') // 'score' | 'ticker' | 'price' | 'signal'
  const [sortDir, setSortDir] = useState('desc')

  // Tarama state
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, text: '' })
  
  // Sinyalleri kalıcı olarak Local Storage'dan oku veya Scanner'dan anında devral!
  const [liveSignals, setLiveSignals] = useState(() => {
    try {
      // 1. Kendi taraması ve Ana Scanner'ın devasa taramasını (500+) kıyasla!
      const saved = localStorage.getItem('finansradar_signals_v2');
      const scannerSaved = localStorage.getItem('lastScanResults');
      
      let localSignals = saved ? JSON.parse(saved) : [];
      let scannerResults = [];
      
      if (scannerSaved) {
        const parsed = JSON.parse(scannerSaved);
        if (parsed && parsed.results) {
          scannerResults = parsed.results.map(r => ({
             ticker: r.symbol?.replace('.IS', '') || 'UNKNOWN',
             signal: r.signal || r.signals?.final?.signal || 'BEKLE',
             score: r.score || r.signals?.final?.score || 50,
             price: r.currentPrice || r.live?.price || 0,
             rsi: r.indicators?.rsi || r.technical?.rsi?.val || null,
             macdHist: r.indicators?.macdHist || r.technical?.macd?.hist || null,
             regime: r.regime || r.analysis?.regime?.name || 'Sakin',
             createdAt: r.timestamp || new Date().toISOString()
          }));
        }
      }

      // 2. Hangisi daha ÇOK veri içeriyorsa onu seç (514 hisse talebi için kritik)
      if (scannerResults.length >= localSignals.length && scannerResults.length > 0) {
        localStorage.setItem('finansradar_signals_v2', JSON.stringify(scannerResults));
        return scannerResults;
      }
      
      return localSignals;
    } catch (e) {
      console.error("Signals Sync Error:", e);
      return [];
    }
  });
  const eventSourceRef = useRef(null)

  // Başlangıçta geçmiş sinyalleri yükle
  const fetchSignals = async () => {
    try {
      setLoading(true)
      const res = await client.get('/signal/history')
      setSignals(res.data)
    } catch {} finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSignals() }, [])

  // ═══ PİYASAYI TARA (SSE ile canlı akış) ═══════════════════════════════
  const startScan = () => {
    if (scanning) return;
    setScanning(true);
    setScanProgress({ current: 0, total: 0, text: 'Bağlantı kuruluyor...' });

    // Toast ve event sızıntılarını temizle
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const token = localStorage.getItem('token');
    const url = `http://localhost:3001/api/signal/scan-all${token ? `?token=${token}` : ''}`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener('init', (e) => {
      const data = JSON.parse(e.data);
      setScanProgress({ current: 0, total: data.total, text: `${data.total} hisse taranacak...` });
    });

    es.addEventListener('signal', (e) => {
      const data = JSON.parse(e.data);
      setLiveSignals(prev => {
        const newData = [...prev];
        const existingIndex = newData.findIndex(s => s.ticker === data.ticker);
        
        if (existingIndex >= 0) {
          newData[existingIndex] = { ...newData[existingIndex], ...data }; // Upsert (Güncelle)
        } else {
          newData.push(data); // Yeni Ekle
        }
        
        // localStorage'a anında kaydet
        localStorage.setItem('finansradar_signals_v2', JSON.stringify(newData));
        return newData;
      });
      
      setScanProgress({
        current: data.index,
        total: data.total,
        text: `${data.ticker} analiz edildi — ${data.signal} (${data.score}/100)`
      });
    });

    es.addEventListener('error', (e) => {
      try {
        const data = JSON.parse(e.data);
        setScanProgress(prev => ({
          ...prev,
          current: data.index,
          text: `⚠ ${data.ticker} atlandı: ${data.error}`
        }));
      } catch {
        // SSE error
      }
    });

    es.addEventListener('done', (e) => {
      const data = JSON.parse(e.data);
      setScanProgress({
        current: data.total,
        total: data.total,
        text: `✅ Tarama tamamlandı! ${data.success} başarılı, ${data.failed} hatalı`
      });
      setScanning(false);
      es.close();
      eventSourceRef.current = null;
    });

    es.onerror = () => {
      setScanning(false);
      es.close();
      eventSourceRef.current = null;
    };
  };

  const stopScan = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setScanning(false);
    setScanProgress(prev => ({ ...prev, text: '⏹ Tarama durduruldu.' }));
  };

  const resetSignals = () => {
    if (window.confirm("Tüm taranan sinyalleri temizlemek istediğinize emin misiniz?")) {
      // Devam eden tarama varsa durdur
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setScanning(false);
      localStorage.removeItem('finansradar_signals_v2');
      setLiveSignals([]);
    }
  };

  // Gösterilecek veri: tarama sırasında liveSignals, yoksa geçmiş signals
  const displayData = liveSignals.length > 0 ? liveSignals : signals

  // Filtreleme
  const filtered = displayData
    .filter(s => {
      if (search && !s.ticker?.toLowerCase().includes(search.toLowerCase())) return false
      if (filterSignal !== 'all' && s.signal !== filterSignal) return false
      return true
    })
    .sort((a, b) => {
      let cmp = 0
      if (sortBy === 'score') cmp = (a.score || 0) - (b.score || 0)
      else if (sortBy === 'ticker') cmp = (a.ticker || '').localeCompare(b.ticker || '')
      else if (sortBy === 'price') cmp = (a.price || 0) - (b.price || 0)
      else if (sortBy === 'signal') cmp = (SIGNAL_ORDER[a.signal] || 3) - (SIGNAL_ORDER[b.signal] || 3)
      return sortDir === 'desc' ? -cmp : cmp
    })

  // Sinyal dağılımı istatistik
  const signalCounts = {}
  displayData.forEach(s => { signalCounts[s.signal] = (signalCounts[s.signal] || 0) + 1 })

  const handleSort = (field) => {
    if (sortBy === field) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortDir('desc') }
  }

  const progressPercent = scanProgress.total > 0 ? Math.round((scanProgress.current / scanProgress.total) * 100) : 0

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp size={24} className="text-cyan-400" /> Piyasa Sinyalleri
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            AI destekli teknik & temel analiz sinyalleri • {displayData.length} hisse
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!scanning ? (
            <button onClick={startScan} className="btn-primary !px-5">
              <Play size={16} /> Piyasayı Tara
            </button>
          ) : (
            <button onClick={stopScan} className="btn-outline !border-red-500/40 !text-red-400 hover:!bg-red-500/10">
              <StopCircle size={16} /> Durdur
            </button>
          )}
          <button onClick={fetchSignals} className="btn-outline" disabled={scanning}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Geçmişi Yükle
          </button>
          {liveSignals.length > 0 && (
            <button onClick={resetSignals} className="btn-outline !border-red-500/30 !text-red-400 hover:!bg-red-500/10" title="Taramayı Sıfırla" disabled={scanning}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
            </button>
          )}
        </div>
      </div>

      {/* Tarama İlerleme Çubuğu */}
      {(scanning || scanProgress.total > 0) && (
        <div className="glass-card p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {scanning ? (
                <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
              ) : (
                <CheckCircle2 size={16} className="text-emerald-400" />
              )}
              <span className="text-xs font-bold text-white">
                {scanning ? 'Tarama Devam Ediyor...' : 'Tarama Tamamlandı'}
              </span>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {scanProgress.current}/{scanProgress.total} ({progressPercent}%)
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${progressPercent}%`,
                background: scanning
                  ? 'linear-gradient(90deg, #8b5cf6, #06b6d4)'
                  : 'linear-gradient(90deg, #10b981, #22c55e)'
              }}
            />
          </div>

          <p className="text-[11px] text-slate-400 truncate">{scanProgress.text}</p>
        </div>
      )}

      {/* Sinyal Dağılımı Kartları */}
      {displayData.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { key: 'all', label: 'Tümü', count: displayData.length, color: 'from-purple-500/20 to-purple-500/5', textColor: 'text-purple-300' },
            { key: 'GÜÇLÜ AL', label: 'Güçlü Al', count: (signalCounts['GÜÇLÜ AL']||0) + (signalCounts['GUCLU AL']||0), color: 'from-emerald-500/20 to-emerald-500/5', textColor: 'text-emerald-300' },
            { key: 'AL', label: 'Al', count: signalCounts['AL']||0, color: 'from-green-500/15 to-green-500/5', textColor: 'text-green-300' },
            { key: 'BEKLE', label: 'Bekle', count: signalCounts['BEKLE']||0, color: 'from-amber-500/15 to-amber-500/5', textColor: 'text-amber-300' },
            { key: 'SAT', label: 'Sat', count: (signalCounts['SAT']||0) + (signalCounts['GÜÇLÜ SAT']||0) + (signalCounts['GUCLU SAT']||0), color: 'from-red-500/15 to-red-500/5', textColor: 'text-red-300' },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setFilterSignal(item.key)}
              className={`glass-card p-3 bg-gradient-to-br ${item.color} transition-all text-left ${filterSignal === item.key ? 'ring-1 ring-purple-500/50 scale-[1.02]' : 'hover:scale-[1.01]'}`}
            >
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">{item.label}</div>
              <div className={`text-xl font-bold mt-0.5 ${item.textColor}`}>{item.count}</div>
            </button>
          ))}
        </div>
      )}

      {/* Arama */}
      <div className="relative">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Hisse ara... (THYAO, AKBNK...)"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all"
        />
      </div>

      {/* Tablo */}
      <div className="glass-card !p-0 overflow-hidden">
        <div className="overflow-auto max-h-[65vh]">
          {loading && displayData.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full data-table">
              <thead className="sticky top-0 bg-[#0c0a1a]/95 backdrop-blur-sm z-10">
                <tr>
                  <th className="cursor-pointer hover:text-slate-300" onClick={() => handleSort('ticker')}>
                    Hisse {sortBy === 'ticker' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="text-right cursor-pointer hover:text-slate-300" onClick={() => handleSort('price')}>
                    Fiyat {sortBy === 'price' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="text-center hidden sm:table-cell">RSI</th>
                  <th className="cursor-pointer hover:text-slate-300" onClick={() => handleSort('score')}>
                    Skor {sortBy === 'score' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="text-center hidden md:table-cell">Rejim</th>
                  <th className="text-right cursor-pointer hover:text-slate-300" onClick={() => handleSort('signal')}>
                    Sinyal {sortBy === 'signal' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-16 text-slate-500">
                      <BarChart3 size={40} className="mx-auto mb-3 text-slate-700" />
                      <div className="text-sm">Henüz sinyal yok.</div>
                      <div className="text-[10px] mt-1">Yukarıdaki <b>"Piyasayı Tara"</b> butonuna tıklayarak tüm BIST hisselerini tarayın.</div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((sig, i) => {
                    const style = SIGNAL_STYLES[sig.signal] || SIGNAL_STYLES['BEKLE']
                    const isNew = scanning && liveSignals.find(l => l.ticker === sig.ticker)

                    return (
                      <tr
                        key={sig.ticker + '-' + i}
                        onClick={() => navigate(`/stock/${sig.ticker}`)}
                        className={`cursor-pointer hover:bg-purple-500/5 transition-all border-b border-white/[0.03] ${isNew ? 'animate-fade-in' : ''}`}
                      >
                        <td>
                          <Link
                            to={`/stock/${sig.ticker}`}
                            className="font-semibold text-purple-400 flex items-center gap-1.5"
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/15 to-cyan-500/15 flex items-center justify-center text-[9px] font-bold text-purple-300">
                              {sig.ticker?.substring(0, 2)}
                            </div>
                            {sig.ticker}
                            <ExternalLink size={10} className="text-slate-600" />
                          </Link>
                        </td>
                        <td className="text-right font-mono text-slate-300 text-xs">
                          {sig.price ? `₺${sig.price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="text-center hidden sm:table-cell">
                          {sig.rsi != null ? (
                            <span className={`text-[11px] font-mono font-bold ${
                              sig.rsi < 30 ? 'text-emerald-400' : sig.rsi > 70 ? 'text-rose-400' : 'text-slate-400'
                            }`}>
                              {sig.rsi}
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(100, Math.max(0, sig.score))}%`,
                                  background: sig.score >= 60 ? 'linear-gradient(90deg, #10b981, #34d399)' :
                                             sig.score >= 45 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' :
                                             'linear-gradient(90deg, #ef4444, #f87171)'
                                }}
                              />
                            </div>
                            <span className="text-[11px] text-slate-300 font-mono font-bold w-6">{sig.score}</span>
                          </div>
                        </td>
                        <td className="text-center hidden md:table-cell">
                          <span className="text-[10px] text-slate-500">{sig.regime || '—'}</span>
                        </td>
                        <td className="text-right">
                          <span className={`text-[11px] font-bold px-2 py-1 rounded-md border ${style}`}>
                            {sig.signal}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default Signals
