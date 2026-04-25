import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, Trash2, Plus, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Bell, StickyNote, Search, Star, List, FolderPlus, X, Edit3, Save, Eye
} from 'lucide-react';
import client from '../api/client';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import { useFavorites } from '../hooks/useFavorites';
import { formatCurrency } from '../utils/formatters';

/* ═══════════════════════════════════════════════════════════ */
/*  WATCHLIST / KİŞİSEL LİSTELER SAYFASI                      */
/*  - Backend watchlist API entegrasyonu                      */
/*  - localStorage favoriler                                  */
/*  - Kişiselleştirilebilir listeler                          */
/*  - Hisse takip, notlar, hedef fiyat                        */
/* ═══════════════════════════════════════════════════════════ */

const TABS = [
  { key: 'favorites', label: 'Favorilerim', icon: Star },
  { key: 'watchlist', label: 'Takip Listem', icon: Eye },
  { key: 'lists', label: 'Listelerim', icon: FolderPlus },
];

export default function Watchlist() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  const [activeTab, setActiveTab] = useState('favorites');
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [allStocks, setAllStocks] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStock, setSelectedStock] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [notes, setNotes] = useState('');

  // Kişisel listeler (localStorage)
  const [customLists, setCustomLists] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fr_custom_lists') || '[]') }
    catch { return [] }
  });
  const [newListName, setNewListName] = useState('');
  const [editingList, setEditingList] = useState(null);

  // Favori hisselerin detaylarını çek
  const [favoriteStocks, setFavoriteStocks] = useState([]);

  useEffect(() => {
    client.get('/stock/list?pageSize=500').then(res => {
      const stocks = res.data?.data || res.data?.stocks || [];
      setAllStocks(stocks);
    }).catch(() => {});
  }, []);

  // Watchlist fetch
  const fetchWatchlist = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await client.get('/watchlist');
      setWatchlist(data || []);
    } catch (err) {
      toast.error('Takip listesi yüklenemedi');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWatchlist();
  }, [user]);

  // Favori hisselerin detaylarını çek
  useEffect(() => {
    const fetchFavDetails = async () => {
      if (favorites.length === 0) { setFavoriteStocks([]); return; }
      const details = [];
      for (const ticker of favorites) {
        try {
          const { data } = await client.get(`/stock/${ticker}`);
          details.push(data);
        } catch { /* skip */ }
      }
      setFavoriteStocks(details);
    };
    fetchFavDetails();
  }, [favorites]);

  const addToWatchlist = async () => {
    if (!selectedStock) return;
    try {
      const stock = allStocks.find(s => (s.ticker || '').replace('.IS', '') === selectedStock);
      await client.post('/watchlist/add', {
        symbol: selectedStock,
        name: stock?.name || selectedStock,
        assetType: 'bist',
        addedPrice: stock?.lastPrice || 0,
        targetPrice: targetPrice ? parseFloat(targetPrice) : undefined,
        stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
        notes,
      });
      toast.success(`${selectedStock} takip listesine eklendi`);
      setShowAddModal(false);
      setSelectedStock(''); setTargetPrice(''); setStopLoss(''); setNotes('');
      fetchWatchlist();
    } catch (err) {
      toast.error('Eklenirken hata oluştu');
    }
  };

  const removeFromWatchlist = async (symbol) => {
    try {
      await client.delete(`/watchlist/${symbol}`);
      toast.success(`${symbol} takip listesinden çıkarıldı`);
      fetchWatchlist();
    } catch (err) {
      toast.error('Silinirken hata oluştu');
    }
  };

  const createCustomList = () => {
    if (!newListName.trim()) return;
    const list = { id: Date.now(), name: newListName.trim(), items: [], createdAt: new Date().toISOString() };
    const updated = [...customLists, list];
    setCustomLists(updated);
    localStorage.setItem('fr_custom_lists', JSON.stringify(updated));
    setNewListName('');
    toast.success('Liste oluşturuldu');
  };

  const deleteCustomList = (id) => {
    const updated = customLists.filter(l => l.id !== id);
    setCustomLists(updated);
    localStorage.setItem('fr_custom_lists', JSON.stringify(updated));
    toast.success('Liste silindi');
  };

  const addToCustomList = (listId, ticker) => {
    const updated = customLists.map(l => {
      if (l.id === listId) {
        if (l.items.includes(ticker)) return l;
        return { ...l, items: [...l.items, ticker] };
      }
      return l;
    });
    setCustomLists(updated);
    localStorage.setItem('fr_custom_lists', JSON.stringify(updated));
    toast.success(`${ticker} listeye eklendi`);
  };

  const removeFromCustomList = (listId, ticker) => {
    const updated = customLists.map(l => {
      if (l.id === listId) return { ...l, items: l.items.filter(i => i !== ticker) };
      return l;
    });
    setCustomLists(updated);
    localStorage.setItem('fr_custom_lists', JSON.stringify(updated));
  };

  const filteredStocks = allStocks.filter(s => {
    const q = search.toLowerCase();
    const t = (s.ticker || '').replace('.IS', '').toLowerCase();
    const n = (s.name || '').toLowerCase();
    return t.includes(q) || n.includes(q);
  });

  return (
    <div className="space-y-6 animate-fade-in px-4 max-w-[1440px] mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Listelerim</h1>
            <p className="text-xs text-slate-400 -mt-0.5">Favoriler, takip listesi ve kişisel listeler</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-white text-sm font-medium shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transition-all"
        >
          <Plus className="w-4 h-4" />
          Hisse Ekle
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white/10 text-white shadow-inner'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {/* FAVORITES TAB */}
        {activeTab === 'favorites' && (
          <motion.div
            key="favorites"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {favorites.length === 0 ? (
              <div className="text-center py-16 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <Star className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Henüz favori hisseniz yok</p>
                <p className="text-xs text-slate-600 mt-1">Hisseler sayfasından ⭐ ekleyebilirsiniz</p>
                <Link to="/stocks" className="inline-block mt-4 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium">Hisselere Git</Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {favoriteStocks.map((stock, i) => {
                  const ticker = (stock.ticker || '').replace('.IS', '');
                  const isPositive = (stock.change1d || 0) >= 0;
                  return (
                    <motion.div
                      key={ticker}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="bg-white/[0.03] backdrop-blur-md border border-white/[0.06] rounded-xl p-4 hover:border-white/10 transition-all group relative"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-300">
                            {ticker.substring(0, 2)}
                          </div>
                          <div>
                            <Link to={`/stock/${ticker}`} className="text-sm font-bold text-white hover:text-violet-300 transition-colors">{ticker}</Link>
                            <div className="text-[10px] text-slate-500 truncate max-w-[140px]">{stock.name}</div>
                          </div>
                        </div>
                        <button onClick={() => toggleFavorite(ticker)} className="text-yellow-400 hover:text-yellow-300 transition-colors">
                          <Star className="w-4 h-4 fill-yellow-400" />
                        </button>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-lg font-bold font-mono text-white">
                            {stock.lastPrice ? `₺${stock.lastPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : '—'}
                          </div>
                          {stock.change1d != null && (
                            <div className={`flex items-center gap-0.5 text-xs font-mono font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                              {isPositive ? '+' : ''}{stock.change1d?.toFixed(2)}%
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {customLists.map(list => (
                            <button
                              key={list.id}
                              onClick={() => addToCustomList(list.id, ticker)}
                              title={`${list.name}'e ekle`}
                              className="p-1.5 rounded-lg bg-white/5 text-slate-500 hover:text-violet-400 hover:bg-white/10 transition-all"
                            >
                              <FolderPlus className="w-3.5 h-3.5" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* WATCHLIST TAB */}
        {activeTab === 'watchlist' && (
          <motion.div
            key="watchlist"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {!user ? (
              <div className="text-center py-16 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <Eye className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Takip listesini görmek için giriş yapın</p>
                <Link to="/login" className="inline-block mt-4 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium">Giriş Yap</Link>
              </div>
            ) : watchlist.length === 0 ? (
              <div className="text-center py-16 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <Eye className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Takip listeniz boş</p>
                <button onClick={() => setShowAddModal(true)} className="inline-block mt-4 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium">Hisse Ekle</button>
              </div>
            ) : (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
                <table className="w-full data-table">
                  <thead>
                    <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-white/5">
                      <th className="text-left py-3 px-4">Hisse</th>
                      <th className="text-right py-3 px-3">Ekleme Fiyatı</th>
                      <th className="text-right py-3 px-3">Hedef</th>
                      <th className="text-right py-3 px-3">Zarar Durdur</th>
                      <th className="py-3 px-3 hidden md:table-cell">Notlar</th>
                      <th className="text-center py-3 px-3 w-16">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlist.map((item, i) => (
                      <motion.tr
                        key={item.symbol}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="group hover:bg-white/[0.02] transition-colors border-b border-white/[0.03]"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/15 to-cyan-500/15 border border-violet-500/15 flex items-center justify-center text-[10px] font-bold text-violet-300">
                              {(item.symbol || '').substring(0, 2)}
                            </div>
                            <div>
                              <Link to={`/stock/${item.symbol}`} className="text-xs font-bold text-white hover:text-violet-300 transition-colors">{item.symbol}</Link>
                              <div className="text-[10px] text-slate-500">{item.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right text-xs font-mono text-slate-300">
                          {item.addedPrice ? `₺${item.addedPrice.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {item.targetPrice ? (
                            <span className="text-xs font-mono text-emerald-400">₺{item.targetPrice.toFixed(2)}</span>
                          ) : (
                            <span className="text-[10px] text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {item.stopLoss ? (
                            <span className="text-xs font-mono text-rose-400">₺{item.stopLoss.toFixed(2)}</span>
                          ) : (
                            <span className="text-[10px] text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 hidden md:table-cell">
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 max-w-[150px] truncate">
                            <StickyNote className="w-3 h-3 flex-shrink-0" />
                            {item.notes || '—'}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => removeFromWatchlist(item.symbol)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {/* CUSTOM LISTS TAB */}
        {activeTab === 'lists' && (
          <motion.div
            key="lists"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Create List */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Yeni liste adı..."
                value={newListName}
                onChange={e => setNewListName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createCustomList()}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
              />
              <button
                onClick={createCustomList}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-white text-sm font-medium shadow-lg shadow-violet-500/20"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            </div>

            {customLists.length === 0 ? (
              <div className="text-center py-16 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <FolderPlus className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Henüz kişisel listeniz yok</p>
                <p className="text-xs text-slate-600 mt-1">Yukarıdan yeni bir liste oluşturun</p>
              </div>
            ) : (
              <div className="space-y-3">
                {customLists.map(list => (
                  <div key={list.id} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <List className="w-4 h-4 text-violet-400" />
                        <h3 className="text-sm font-bold text-white">{list.name}</h3>
                        <span className="text-[10px] text-slate-500">{list.items.length} hisse</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => navigate(`/scanner?symbols=${list.items.join(',')}`)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
                          title="Listeyi Tara"
                        >
                          <Radar className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteCustomList(list.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {list.items.length === 0 ? (
                      <p className="text-xs text-slate-600 py-2">Bu liste boş. Favorilerden hisse ekleyebilirsiniz.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {list.items.map(ticker => (
                          <div key={ticker} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                            <Link to={`/stock/${ticker}`} className="text-xs font-medium text-white hover:text-violet-300">{ticker}</Link>
                            <button
                              onClick={() => removeFromCustomList(list.id, ticker)}
                              className="text-slate-500 hover:text-rose-400 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Stock Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#0f1225] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-white">Takip Listesine Ekle</h3>
                <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Hisse Seç</label>
                  <input
                    type="text"
                    placeholder="Ara..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 mb-2"
                  />
                  <select
                    value={selectedStock}
                    onChange={e => setSelectedStock(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                  >
                    <option value="">Hisse seçin...</option>
                    {filteredStocks.map(s => (
                      <option key={s.ticker} value={(s.ticker || '').replace('.IS', '')}>
                        {(s.ticker || '').replace('.IS', '')} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Hedef Fiyat</label>
                    <input
                      type="number"
                      placeholder="₺"
                      value={targetPrice}
                      onChange={e => setTargetPrice(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Zarar Durdur</label>
                    <input
                      type="number"
                      placeholder="₺"
                      value={stopLoss}
                      onChange={e => setStopLoss(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Notlar</label>
                  <textarea
                    placeholder="Not ekleyin..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 resize-none"
                  />
                </div>

                <button
                  onClick={addToWatchlist}
                  disabled={!selectedStock}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-white text-sm font-bold shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Ekle
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
