import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Filter, List, Grid, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Building2, Layers, BarChart3, RefreshCw, Plus, SlidersHorizontal,
  ArrowUpDown, Eye, Star, Sparkles
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

import { SIGNAL_COLORS } from '../constants/colors';

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function StockCard({ stock, onNavigate, index }) {
  const baseSymbol = stock.ticker?.replace('.IS', '') || '';
  const isPositive = (stock.change1d || 0) >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="glass-card glass-card-hover p-4 cursor-pointer group relative overflow-hidden"
      onClick={() => onNavigate(baseSymbol)}
    >
      {/* Hover glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-cyan-500/0 group-hover:from-purple-500/5 group-hover:to-cyan-500/5 transition-all duration-500" />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-300 group-hover:from-purple-500/30 group-hover:to-cyan-500/30 transition-all">
              {baseSymbol.substring(0, 2)}
            </div>
            <div>
              <div className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">{baseSymbol}</div>
              <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                {stock.name?.replace(' (BIST Hisse Senedi)', '').replace(' (Otomatik Eklendi)', '')}
              </div>
            </div>
          </div>
          {stock.lastPrice && (
            <div className="text-right">
              <div className="text-sm font-mono font-bold text-white">
                ₺{stock.lastPrice?.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {stock.change1d != null && (
                <div className={`flex items-center justify-end gap-0.5 text-[10px] font-mono font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                  {isPositive ? '+' : ''}{stock.change1d?.toFixed(2)}%
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-2">
            {stock.sector && stock.sector !== 'Unknown' && (
              <span className="px-2 py-0.5 rounded-md bg-white/5 text-slate-400 border border-white/5">
                {stock.sector}
              </span>
            )}
            <span className="text-slate-600">{stock.type?.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-1 text-slate-500 group-hover:text-purple-400 transition-colors">
            <Eye size={10} />
            <span>Detay</span>
            <ArrowUpRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Ratio mini-bars */}
        {stock.ratios && (
          <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-3 gap-2 text-[9px]">
            {stock.ratios.fk != null && (
              <div>
                <span className="text-slate-600">F/K:</span>{' '}
                <span className={`font-mono ${stock.ratios.fk > 0 && stock.ratios.fk < 15 ? 'text-emerald-400' : stock.ratios.fk > 30 ? 'text-rose-400' : 'text-slate-300'}`}>
                  {stock.ratios.fk?.toFixed(1)}
                </span>
              </div>
            )}
            {stock.ratios.currentRatio != null && (
              <div>
                <span className="text-slate-600">Cari:</span>{' '}
                <span className={`font-mono ${stock.ratios.currentRatio > 1.5 ? 'text-emerald-400' : stock.ratios.currentRatio < 1 ? 'text-rose-400' : 'text-slate-300'}`}>
                  {stock.ratios.currentRatio?.toFixed(2)}
                </span>
              </div>
            )}
            {stock.ratios.netMargin != null && (
              <div>
                <span className="text-slate-600">Net M:</span>{' '}
                <span className={`font-mono ${stock.ratios.netMargin > 10 ? 'text-emerald-400' : stock.ratios.netMargin < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                  %{stock.ratios.netMargin?.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Signal badge if available */}
        {stock.signal && (
          <div className="mt-2">
            <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full border ${SIGNAL_COLORS[stock.signal]?.bg || 'bg-slate-500/10'} ${SIGNAL_COLORS[stock.signal]?.text || 'text-slate-400'} ${SIGNAL_COLORS[stock.signal]?.border || 'border-slate-500/20'}`}>
              {stock.signal}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function StockRow({ stock, onNavigate }) {
  const baseSymbol = stock.ticker?.replace('.IS', '') || '';
  const isPositive = (stock.change1d || 0) >= 0;

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="group cursor-pointer hover:bg-white/[0.03] transition-colors border-b border-white/[0.03]"
      onClick={() => onNavigate(baseSymbol)}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/15 to-cyan-500/15 border border-purple-500/15 flex items-center justify-center text-[10px] font-bold text-purple-300 flex-shrink-0">
            {baseSymbol.substring(0, 2)}
          </div>
          <div>
            <div className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">{baseSymbol}</div>
            <div className="text-[10px] text-slate-500 truncate max-w-[160px]">
              {stock.name?.replace(' (BIST Hisse Senedi)', '').replace(' (Otomatik Eklendi)', '')}
            </div>
          </div>
        </div>
      </td>
      <td className="py-3 px-3 text-right">
        <span className="text-xs font-mono font-bold text-white">
          {stock.lastPrice ? `₺${stock.lastPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
        </span>
      </td>
      <td className="py-3 px-3 text-right">
        {stock.change1d != null && (
          <span className={`flex items-center justify-end gap-0.5 text-[10px] font-mono font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {isPositive ? '+' : ''}{stock.change1d?.toFixed(2)}%
          </span>
        )}
      </td>
      <td className="py-3 px-3 hidden md:table-cell">
        <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded bg-white/5">{stock.sector || '—'}</span>
      </td>
      <td className="py-3 px-3 text-center hidden lg:table-cell">
        <span className="text-[10px] font-mono text-slate-400">{stock.ratios?.fk ? stock.ratios.fk.toFixed(1) : '—'}</span>
      </td>
      <td className="py-3 px-3 text-center hidden lg:table-cell">
        <span className="text-[10px] font-mono text-slate-400">{stock.ratios?.currentRatio ? stock.ratios.currentRatio.toFixed(2) : '—'}</span>
      </td>
      <td className="py-3 px-3 text-center hidden xl:table-cell">
        <span className={`text-[10px] font-mono ${stock.ratios?.netMargin > 10 ? 'text-emerald-400' : stock.ratios?.netMargin < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
          {stock.ratios?.netMargin ? `%${stock.ratios.netMargin.toFixed(1)}` : '—'}
        </span>
      </td>
      <td className="py-3 px-3 text-center">
        <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500 group-hover:text-purple-400 transition-colors">
          <Eye size={12} />
          <ArrowUpRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </td>
    </motion.tr>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function AllStocks() {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 48, total: 0, totalPages: 1, hasPrev: false, hasNext: false });
  const [pageSize, setPageSize] = useState(48);
  const [filters, setFilters] = useState({ availableSectors: [], availableTypes: [] });
  const [viewMode, setViewMode] = useState('grid'); // 'table' | 'grid'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedSector, setSelectedSector] = useState('');
  const [selectedIndex, setSelectedIndex] = useState('');
  const [sortBy, setSortBy] = useState('ticker');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState(null);

  // ────────────────────────────────────────────────
  // Fetch stocks
  // ────────────────────────────────────────────────
  const fetchStocks = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder,
        type: 'bist',
      });
      if (selectedSector) params.set('sector', selectedSector);
      if (selectedIndex) params.set('indexFilter', selectedIndex);

      const { data } = await client.get(`/stock/list?${params}`);
      const stocksData = data.data || data.stocks || data.items || [];
      setStocks(stocksData);
      const pg = data.pagination || {};
      setPagination({
        page: pg.page || page,
        pageSize: pg.pageSize || pageSize,
        total: pg.total || 0,
        totalPages: pg.totalPages || 1,
        hasPrev: pg.hasPrev ?? (page > 1),
        hasNext: pg.hasNext ?? (page < (pg.totalPages || 1)),
      });
      if (data.filters) setFilters(data.filters);
    } catch (err) {
      toast.error('Hisse listesi yüklenemedi');
    }
    setLoading(false);
  }, [sortBy, sortOrder, selectedSector, selectedIndex, pageSize]);

  // ────────────────────────────────────────────────
  // Fetch stats (sadece bir kere)
  // ────────────────────────────────────────────────
  useEffect(() => {
    client.get('/stock/stats').then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  // ────────────────────────────────────────────────
  // Fetch stocks when filter/sort deps change — always reset to page 1
  // ────────────────────────────────────────────────
  useEffect(() => {
    fetchStocks(1);
  }, [fetchStocks]);

  // ────────────────────────────────────────────────
  // Sayfa boyutu değişince sayfa 1'e dön ve yeniden yükle
  // ────────────────────────────────────────────────
  useEffect(() => {
    fetchStocks(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  // ────────────────────────────────────────────────
  // Search with debounce
  // ────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data } = await client.get(`/stock/search?q=${encodeURIComponent(searchQuery)}&limit=20`);
        setSearchResults(data.results || []);
      } catch {
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const navigateToStock = (ticker) => {
    navigate(`/stock/${ticker}`);
  };

  const displayStocks = searchResults || stocks;

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in pb-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
            <List className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Tüm BIST Hisseleri</h1>
            <p className="text-xs text-slate-400 -mt-0.5">
              {stats ? `${stats.active} aktif hisse • ${stats.types?.find(t => t.type === 'bist')?.count || 0} BIST` : 'Yükleniyor...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 transition-colors ${viewMode === 'table' ? 'bg-purple-500/20 text-purple-300' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-purple-500/20 text-purple-300' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Grid size={16} />
            </button>
          </div>
          <button onClick={() => setShowFilters(p => !p)} className={`p-2 rounded-lg border transition-colors ${showFilters ? 'bg-purple-500/20 border-purple-500/30 text-purple-300' : 'border-white/10 text-slate-500 hover:text-slate-300'}`}>
            <SlidersHorizontal size={16} />
          </button>
          <button onClick={() => fetchStocks(1)} className="p-2 rounded-lg border border-white/10 text-slate-500 hover:text-white transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </motion.div>

      {/* Stats Bar */}
      <AnimatePresence>
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            {[
              { label: 'Toplam Hisse', value: stats.total, icon: Layers, color: 'from-purple-500/20 to-purple-500/5' },
              { label: 'Aktif', value: stats.active, icon: TrendingUp, color: 'from-emerald-500/20 to-emerald-500/5' },
              { label: 'BIST', value: stats.types?.find(t => t.type === 'bist')?.count || 0, icon: Building2, color: 'from-red-500/20 to-red-500/5' },
              { label: 'Diğer', value: (stats.total || 0) - (stats.types?.find(t => t.type === 'bist')?.count || 0), icon: BarChart3, color: 'from-cyan-500/20 to-cyan-500/5' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className={`glass-card p-3 bg-gradient-to-br ${item.color}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">{item.label}</div>
                    <div className="text-xl font-bold text-white mt-0.5">{item.value}</div>
                  </div>
                  <item.icon size={20} className="text-slate-600" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="relative"
      >
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Hisse Ara... (örn: THYAO, Garanti, Ereğli)"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/30 transition-all"
        />
        {searchLoading && (
          <RefreshCw size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-400 animate-spin" />
        )}
        {searchResults && (
          <div className="absolute right-14 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
            {searchResults.length} sonuç
          </div>
        )}
      </motion.div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-4 overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-3">
              <Filter size={14} className="text-purple-400" />
              <span className="text-xs font-bold text-white">Filtreler</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Sector Filter */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Sektör</label>
                <select
                  value={selectedSector}
                  onChange={e => { setSelectedSector(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                >
                  <option value="">Tüm Sektörler</option>
                  {filters.availableSectors?.map(s => (
                    <option key={s.sector} value={s.sector}>{s.sector} ({s.count})</option>
                  ))}
                </select>
              </div>

              {/* Index Filter */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Endeks</label>
                <select
                  value={selectedIndex}
                  onChange={e => { setSelectedIndex(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                >
                  <option value="">Tüm Hisseler</option>
                  <option value="bist30">BIST 30</option>
                  <option value="bist100">BIST 100</option>
                </select>
              </div>

              {/* Sort */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Sıralama</label>
                <select
                  value={`${sortBy}_${sortOrder}`}
                  onChange={e => {
                    const [field, order] = e.target.value.split('_');
                    setSortBy(field);
                    setSortOrder(order);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                >
                  <option value="ticker_asc">Sembol (A-Z)</option>
                  <option value="ticker_desc">Sembol (Z-A)</option>
                  <option value="lastPrice_desc">Fiyat (Yüksek → Düşük)</option>
                  <option value="lastPrice_asc">Fiyat (Düşük → Yüksek)</option>
                  <option value="marketCap_desc">Piyasa Değeri (Büyük → Küçük)</option>
                  <option value="name_asc">İsim (A-Z)</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-20"
          >
            <RefreshCw size={32} className="text-purple-400 mx-auto mb-3 animate-spin" />
            <div className="text-sm text-slate-400">Hisseler yükleniyor...</div>
          </motion.div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
          >
            {displayStocks.map((stock, idx) => (
              <StockCard key={stock.ticker} stock={stock} onNavigate={navigateToStock} index={idx} />
            ))}
          </motion.div>
        ) : (
          /* Table View */
          <motion.div
            key="table"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass-card overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-white/5">
                    <th className="text-left py-3 px-4 cursor-pointer hover:text-slate-300 transition-colors" onClick={() => handleSort('ticker')}>
                      <span className="flex items-center gap-1">Hisse <ArrowUpDown size={10} /></span>
                    </th>
                    <th className="text-right py-3 px-3 cursor-pointer hover:text-slate-300 transition-colors" onClick={() => handleSort('lastPrice')}>
                      <span className="flex items-center justify-end gap-1">Fiyat <ArrowUpDown size={10} /></span>
                    </th>
                    <th className="text-right py-3 px-3 cursor-pointer hover:text-slate-300 transition-colors" onClick={() => handleSort('change1d')}>
                      <span className="flex items-center justify-end gap-1">Değişim <ArrowUpDown size={10} /></span>
                    </th>
                    <th className="py-3 px-3 hidden md:table-cell cursor-pointer hover:text-slate-300 transition-colors" onClick={() => handleSort('sector')}>Sektör</th>
                    <th className="text-center py-3 px-3 hidden lg:table-cell">F/K</th>
                    <th className="text-center py-3 px-3 hidden lg:table-cell">Cari Oran</th>
                    <th className="text-center py-3 px-3 hidden xl:table-cell">Net Marj</th>
                    <th className="text-center py-3 px-3 w-16">Detay</th>
                  </tr>
                </thead>
                <tbody>
                  {displayStocks.map(stock => (
                    <StockRow key={stock.ticker} stock={stock} onNavigate={navigateToStock} />
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination */}
      <AnimatePresence>
        {!searchResults && pagination.totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between flex-wrap gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="text-[10px] text-slate-500">
                Sayfa {pagination.page} / {pagination.totalPages} • Toplam {pagination.total} hisse
              </div>
              {/* Page Size Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500">Göster:</span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); }}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                >
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={514}>Tümü (514)</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { setPagination(p => ({ ...p, page: p.page - 1 })); fetchStocks(pagination.page - 1); }}
                disabled={!pagination.hasPrev}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 text-slate-400 hover:text-white hover:border-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} className="inline" /> Önceki
              </button>

              {/* Page numbers */}
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const startPage = Math.max(1, pagination.page - 2);
                const pageNum = startPage + i;
                if (pageNum > pagination.totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => fetchStocks(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                      pageNum === pagination.page
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'text-slate-500 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => { setPagination(p => ({ ...p, page: p.page + 1 })); fetchStocks(pagination.page + 1); }}
                disabled={!pagination.hasNext}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 text-slate-400 hover:text-white hover:border-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Sonraki <ChevronRight size={14} className="inline" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      <AnimatePresence>
        {!loading && displayStocks.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <Building2 size={48} className="text-slate-700 mx-auto mb-3" />
            <div className="text-sm text-slate-400 mb-2">Filtrelerinize uygun hisse bulunamadı</div>
            <div className="text-[10px] text-slate-600">Filtrelerinizi genişletmeyi veya farklı bir arama terimi denemeyi deneyin</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
