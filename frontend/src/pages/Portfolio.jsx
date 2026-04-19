import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PieChart as PieIcon, Plus, Trash2, Download, Zap, X, FileText, Star } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import client from '../api/client'
import { formatCurrency, formatPercent } from '../utils/formatters'
import { STOCK_COLORS, getColor } from '../constants/colors'
import ChartCard from '../components/ChartCard'
import { useFavorites } from '../hooks/useFavorites'

const Portfolio = () => {
  const [data, setData] = useState({ items: [], summary: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [ticker, setTicker] = useState('')
  const [shares, setShares] = useState('')
  const [avgCost, setAvgCost] = useState('')
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState('')
  const [optimizing, setOptimizing] = useState(false)
  const [optimizedWeights, setOptimizedWeights] = useState(null)
  const { favorites, toggle } = useFavorites()

  useEffect(() => { fetchPortfolio() }, [])

  const fetchPortfolio = async () => {
    try { setLoading(true); const res = await client.get('/portfolio'); setData(res.data) }
    catch { setError('Portföy yüklenemedi.') } finally { setLoading(false) }
  }

  const handleAdd = async (e) => {
    e.preventDefault(); setModalError(''); setModalLoading(true)
    try {
      await client.post('/portfolio/add', { ticker: ticker.toUpperCase(), shares: parseFloat(shares), avgCost: parseFloat(avgCost) })
      setShowModal(false); setTicker(''); setShares(''); setAvgCost(''); fetchPortfolio()
    } catch (err) { setModalError(err.response?.data?.error || 'Eklenemedi.') }
    finally { setModalLoading(false) }
  }

  const handleDelete = async (t) => {
    if (!window.confirm(`${t} portföyden çıkarılsın mı?`)) return
    try { await client.delete(`/portfolio/${t}`); fetchPortfolio() } catch { alert('Silinemedi.') }
  }

  // Madde 45: Excel export
  const exportToExcel = () => {
    const rows = data.items?.map(item => ({
      Hisse: item.ticker, Adet: item.shares, 'Ort. Maliyet': item.avgCost,
      'Güncel Fiyat': item.currentPrice, 'Toplam Değer': item.value?.toFixed(2),
      'K/Z (₺)': item.pl?.toFixed(2), 'K/Z (%)': item.plPercent?.toFixed(2),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Portföy')
    XLSX.writeFile(wb, `portfoy_${new Date().toLocaleDateString('tr-TR')}.xlsx`)
  }

  // Phase 4: Kapsamlı Portföy Raporu (PDF)
  const exportToPDF = () => {
    const doc = new jsPDF()
    const dateStr = new Date().toLocaleDateString('tr-TR')
    
    // Header
    doc.setFontSize(22)
    doc.setTextColor(139, 92, 246) // Purple color
    doc.text('FinansRadar - Portfoy Raporu', 14, 20)
    
    doc.setFontSize(11)
    doc.setTextColor(100)
    doc.text(`Tarih: ${dateStr}`, 14, 28)
    
    // Summary Data
    doc.setFontSize(12)
    doc.setTextColor(0)
    doc.text(`Toplam Maliyet: ${formatCurrency(summary.totalCost || 0)}`, 14, 40)
    doc.text(`Guncel Deger: ${formatCurrency(summary.totalValue || 0)}`, 14, 47)
    
    const isProfit = (summary.totalPL || 0) >= 0
    doc.setTextColor(isProfit ? 22 : 220, isProfit ? 163 : 38, isProfit ? 74 : 38) // Green or Red
    doc.text(`Net K/Z: ${isProfit ? '+' : ''}${formatCurrency(summary.totalPL || 0)}  (%${formatPercent(summary.totalPLPercent || 0)})`, 14, 54)

    // Table Data
    const tableColumn = ["Hisse", "Adet", "Ort. Maliyet", "Guncel Fiyat", "Toplam Deger", "Net K/Z"]
    const tableRows = []

    data.items?.forEach(item => {
      const rowData = [
        item.ticker,
        item.shares.toString(),
        formatCurrency(item.avgCost),
        formatCurrency(item.currentPrice),
        formatCurrency(item.value),
        `${formatCurrency(item.pl)} (%${formatPercent(item.plPercent)})`
      ]
      tableRows.push(rowData)
    })

    doc.autoTable({
      startY: 65,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    })
    
    doc.setFontSize(10)
    doc.setTextColor(150)
    doc.text('Yapay Zeka Destekli FinansRadar Tarafindan Olusturulmustur.', 14, doc.lastAutoTable.finalY + 15)

    doc.save(`portfoy_raporu_${dateStr}.pdf`)
  }

  // Phase 2: HRP Optimizasyon (Yapay Zeka)
  const handleOptimize = async () => {
    if (data.items.length < 2) {
      alert('Optimizasyon için en az 2 hisseniz olmalı.');
      return;
    }
    setOptimizing(true);
    try {
      const res = await client.post('/portfolio/optimize');
      setOptimizedWeights(res.data.weights);
    } catch (err) {
      alert(err.response?.data?.error || 'Optimizasyon sırasında hata oluştu.');
    } finally {
      setOptimizing(false);
    }
  }

  // Madde 20: Pie chart data
  const pieData = data.items?.map(item => ({ name: item.ticker, value: item.value || item.shares * item.avgCost })) || []

  const { summary } = data
  const isProfit = (summary.totalPL || 0) >= 0

  if (loading && data.items.length === 0) return <div className="flex items-center justify-center h-[60vh]"><div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><PieIcon size={24} className="text-purple-400" /> Portföy Yönetimi</h1>
          <p className="text-sm text-slate-500 mt-1">Varlıklarınızı yönetin ve performansı takip edin</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleOptimize} disabled={optimizing || data.items.length < 2} className="btn-outline text-amber-400 border-amber-500/30 hover:!border-amber-500/50 hover:!text-amber-300 disabled:opacity-50">
            <Zap size={14} className={optimizing ? "animate-pulse" : ""} /> {optimizing ? 'Optimize Ediliyor...' : 'Yapay Zeka ile Optimize Et'}
          </button>
          <button onClick={exportToPDF} className="btn-outline text-rose-400 border-rose-500/30 hover:!border-rose-500/50 hover:!text-rose-300">
            <FileText size={14} /> PDF Rapor
          </button>
          <button onClick={exportToExcel} className="btn-outline text-green-400 border-green-500/30 hover:!border-green-500/50 hover:!text-green-300">
            <Download size={14} /> Excel
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={16} /> Hisse Ekle</button>
        </div>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg">{error}</div>}

      {/* Summary + Pie Chart */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 grid grid-cols-4 gap-3">
          {[
            { label: 'Toplam Maliyet', value: formatCurrency(summary.totalCost || 0), color: 'text-white' },
            { label: 'Güncel Değer', value: formatCurrency(summary.totalValue || 0), color: 'text-cyan-400' },
            { label: 'K/Z', value: formatCurrency(summary.totalPL || 0), color: isProfit ? 'text-green-400' : 'text-red-400' },
            { label: 'K/Z %', value: `${isProfit ? '+' : ''}${formatPercent(summary.totalPLPercent || 0)}`, color: isProfit ? 'text-green-400' : 'text-red-400' },
          ].map(c => (
            <div key={c.label} className="glass-card glass-card-hover p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{c.label}</p>
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>
        {/* Madde 20: Pie Chart */}
        <div className="col-span-4">
          <ChartCard icon="🍩" title="Dağılım">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={55} innerRadius={30} dataKey="value" paddingAngle={3}>
                    {pieData.map((entry, i) => <Cell key={i} fill={getColor(entry.name)} />)}
                  </Pie>
                  <Tooltip formatter={v => `₺${typeof v === 'number' ? v.toFixed(0) : v}`}
                    contentStyle={{ background: '#1a1a35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-slate-500 text-sm py-6">Veri yok</p>}
          </ChartCard>
        </div>
      </div>

      {/* Favorites / Watchlist Strip */}
      {favorites.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Star size={16} className="text-amber-400 fill-amber-400" />
            <h2 className="text-sm font-bold text-white">Takip Listesi (Satın Alınmamış Gözlemler)</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {favorites.map(t => (
              <div key={t} className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden group hover:bg-white/10 transition-all">
                <Link to={`/stock/${t}`} className="px-3 py-1.5 text-xs font-semibold text-purple-300 hover:text-white transition-colors">
                  {t}
                </Link>
                <button 
                  onClick={() => toggle(t)} 
                  className="px-2 py-1.5 border-l border-white/5 text-slate-500 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                  title="Takipten Çıkar"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="glass-card !p-0 overflow-hidden">
        <table className="w-full data-table">
          <thead><tr>
            <th>Hisse</th><th className="text-right">Adet</th><th className="text-right">Ort. Maliyet</th>
            <th className="text-right">Güncel Fiyat</th><th className="text-right">Toplam Değer</th>
            <th className="text-right">K/Z</th><th className="text-center">İşlem</th>
          </tr></thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-10 text-slate-500">Portföyde hisse yok.</td></tr>
            ) : data.items.map(item => (
              <tr key={item.ticker}>
                <td><span className="font-semibold text-purple-400">{item.ticker}</span></td>
                <td className="text-right font-mono text-slate-400">{item.shares}</td>
                <td className="text-right font-mono text-slate-400">{formatCurrency(item.avgCost)}</td>
                <td className="text-right font-mono">{formatCurrency(item.currentPrice)}</td>
                <td className="text-right font-mono">{formatCurrency(item.value)}</td>
                <td className={`text-right font-mono font-semibold ${(item.pl||0)>=0?'text-green-400':'text-red-400'}`}>
                  {(item.pl||0)>=0?'+':''}{formatCurrency(item.pl||0)}
                  <span className="block text-[11px] opacity-70">{(item.pl||0)>=0?'+':''}{formatPercent(item.plPercent||0)}</span>
                </td>
                <td className="text-center">
                  <button onClick={() => handleDelete(item.ticker)} className="text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"><Trash2 size={16}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* AI Optimizasyon Sonucu Modal */}
      {optimizedWeights && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOptimizedWeights(null)} />
          <div className="relative glass-card w-full max-w-lg p-0" style={{ boxShadow: '0 0 50px rgba(245, 158, 11, 0.2)' }}>
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-amber-500/10">
              <div>
                <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2"><Zap size={20} /> AI Portföy Optimizasyonu (HRP)</h2>
                <p className="text-xs text-amber-400/70 mt-1">Hiyerarşik Risk Paritesi (Machine Learning) ile risk/getiri hedefleri</p>
              </div>
              <button onClick={() => setOptimizedWeights(null)} className="text-slate-400 hover:text-white"><X size={20}/></button>
            </div>
            
            <div className="p-5 overflow-y-auto max-h-[60vh]">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-white/5">
                    <th className="py-2">Hisse</th>
                    <th className="py-2 text-right">Mevcut Ağırlık</th>
                    <th className="py-2 text-right">AI Hedef Ağırlık</th>
                    <th className="py-2 text-right">Aksiyon Önerisi</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(optimizedWeights).sort((a,b) => b[1] - a[1]).map(([ticker, targetWeight]) => {
                    const item = data.items.find(i => i.ticker === ticker);
                    const currentWeight = item ? (item.value / summary.totalValue) : 0;
                    const diff = targetWeight - currentWeight;
                    
                    return (
                      <tr key={ticker} className="border-b border-white/5 last:border-0 text-sm">
                        <td className="py-3 font-bold text-white">{ticker}</td>
                        <td className="py-3 text-right opacity-70">{formatPercent(currentWeight * 100)}</td>
                        <td className="py-3 text-right font-mono text-amber-400 font-bold">{formatPercent(targetWeight * 100)}</td>
                        <td className="py-3 text-right">
                          {diff > 0.02 ? (
                            <span className="text-green-400 text-xs px-2 py-1 bg-green-500/10 rounded flex items-center justify-end gap-1"><Plus size={10}/> Ekle</span>
                          ) : diff < -0.02 ? (
                            <span className="text-red-400 text-xs px-2 py-1 bg-red-500/10 rounded flex items-center justify-end gap-1"><Trash2 size={10}/> Azalt</span>
                          ) : (
                            <span className="text-slate-400 text-[10px] uppercase">Koru</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/10 text-xs text-slate-400">
                <span className="text-white font-bold block mb-1">Not:</span> 
                Hiyerarşik Risk Paritesi, korelasyonu düşük varlıkları dengeli bir araya getirerek olası bir kriz senaryosuna (Drawdown) en dayanıklı portföyü üretir.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative glass-card w-full max-w-md" style={{ boxShadow: '0 0 40px rgba(139,92,246,0.15)' }}>
            <h2 className="text-lg font-bold mb-4">Yeni Hisse Ekle</h2>
            {modalError && <div className="bg-red-500/10 text-red-400 text-sm p-2 rounded-lg mb-3">{modalError}</div>}
            <form onSubmit={handleAdd} className="space-y-4">
              <div><label className="text-xs font-semibold text-slate-400 mb-1 block uppercase tracking-wider">Hisse Kodu</label>
                <input value={ticker} onChange={e => setTicker(e.target.value)} required placeholder="THYAO" className="input-field uppercase" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-slate-400 mb-1 block uppercase tracking-wider">Adet</label>
                  <input type="number" step="any" min="0.01" value={shares} onChange={e => setShares(e.target.value)} required className="input-field" /></div>
                <div><label className="text-xs font-semibold text-slate-400 mb-1 block uppercase tracking-wider">Ort. Maliyet (₺)</label>
                  <input type="number" step="any" min="0.01" value={avgCost} onChange={e => setAvgCost(e.target.value)} required className="input-field" /></div>
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
  )
}

export default Portfolio
