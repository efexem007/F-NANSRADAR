import { useState, useContext } from 'react'
import client from '../api/client'
import { AuthContext } from '../context/AuthContext'
import { Settings as SettingsIcon, Upload, Download, User, Database } from 'lucide-react'
import ChartCard from '../components/ChartCard'

const Settings = () => {
  const { user } = useContext(AuthContext)
  const [ticker, setTicker] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState({ type: '', text: '' })

  const handleUpload = async (e) => {
    e.preventDefault(); if (!ticker || !file) return
    setUploading(true); setUploadMsg({ type: '', text: '' })
    const formData = new FormData(); formData.append('file', file)
    try {
      await client.post(`/upload/fundamental/${ticker.toUpperCase()}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setUploadMsg({ type: 'success', text: `${ticker.toUpperCase()} verileri yüklendi.` })
      setTicker(''); setFile(null)
    } catch (err) { setUploadMsg({ type: 'error', text: err.response?.data?.error || 'Hata' }) }
    finally { setUploading(false) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div><h1 className="text-2xl font-bold flex items-center gap-2"><SettingsIcon size={24} className="text-slate-400" /> Ayarlar</h1>
        <p className="text-sm text-slate-500 mt-1">Profil ve veri yönetimi</p></div>

      <div className="grid grid-cols-2 gap-6">
        <ChartCard icon="👤" title="Profil">
          <div className="space-y-4">
            <div><p className="text-xs text-slate-500 uppercase tracking-wider">Ad</p><p className="text-lg font-medium mt-0.5">{user?.name || '—'}</p></div>
            <div><p className="text-xs text-slate-500 uppercase tracking-wider">E-posta</p><p className="text-lg font-medium mt-0.5">{user?.email || '—'}</p></div>
          </div>
        </ChartCard>

        <ChartCard icon="📊" title="Temel Veri Yükle">
          <p className="text-xs text-slate-500 mb-4">Bilanço verilerini .xlsx olarak yükleyin.</p>
          {uploadMsg.text && <div className={`text-sm p-2 rounded-lg mb-3 ${uploadMsg.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>{uploadMsg.text}</div>}
          <form onSubmit={handleUpload} className="space-y-3">
            <div><label className="text-xs font-semibold text-slate-400 mb-1 block uppercase tracking-wider">Hisse</label>
              <input value={ticker} onChange={e => setTicker(e.target.value)} required placeholder="GARAN" className="input-field uppercase" /></div>
            <div><label className="text-xs font-semibold text-slate-400 mb-1 block uppercase tracking-wider">Dosya</label>
              <input type="file" accept=".xlsx,.xls" onChange={e => setFile(e.target.files[0])} required
                className="w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white/5 file:text-purple-400 hover:file:bg-white/10 cursor-pointer" /></div>
            <button type="submit" disabled={uploading} className="btn-primary w-full"><Upload size={14} /> Yükle</button>
          </form>
        </ChartCard>
      </div>
    </div>
  )
}

export default Settings
