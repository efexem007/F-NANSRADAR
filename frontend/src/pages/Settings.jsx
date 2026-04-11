import { useState, useContext } from 'react';
import client from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { Settings as SettingsIcon, Upload, Download, Copy, CheckCircle, Database, User } from 'lucide-react';

const Settings = () => {
  const { user } = useContext(AuthContext);
  const [ticker, setTicker] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState({ type: '', text: '' });
  const [qrCode, setQrCode] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [importData, setImportData] = useState('');
  const [importMsg, setImportMsg] = useState('');

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!ticker || !file) return;
    setUploading(true); setUploadMsg({ type: '', text: '' });
    const formData = new FormData(); formData.append('file', file);
    try {
      await client.post(`/upload/fundamental/${ticker.toUpperCase()}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploadMsg({ type: 'success', text: `${ticker.toUpperCase()} verileri başarıyla yüklendi.` });
      setTicker(''); setFile(null);
    } catch (err) { setUploadMsg({ type: 'error', text: err.response?.data?.error || 'Yükleme hatası' }); }
    finally { setUploading(false); }
  };

  const handleExport = async () => {
    try { setSyncLoading(true); const res = await client.get('/sync/export'); setQrCode(res.data.qrCode); } catch {} finally { setSyncLoading(false); }
  };

  const handleImport = async () => {
    if (!importData) return;
    try { setSyncLoading(true); await client.post('/sync/import', { data: importData }); setImportMsg('Portföy başarıyla içe aktarıldı!'); setImportData(''); }
    catch { setImportMsg('İçe aktarma hatası.'); } finally { setSyncLoading(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><SettingsIcon size={24} className="text-text-muted" /> Ayarlar</h1>
        <p className="text-sm text-text-muted mt-1">Profil, veri yükleme ve yedekleme</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile */}
        <div className="glass-card">
          <h2 className="text-sm font-bold mb-4 flex items-center gap-2 border-b border-border pb-3"><User size={16} className="text-accent" /> Profil Bilgileri</h2>
          <div className="space-y-4">
            <div><p className="text-xs text-text-muted uppercase tracking-wider">Ad Soyad</p><p className="text-lg font-medium mt-0.5">{user?.name || '—'}</p></div>
            <div><p className="text-xs text-text-muted uppercase tracking-wider">E-posta</p><p className="text-lg font-medium mt-0.5">{user?.email || '—'}</p></div>
          </div>
        </div>

        {/* Upload */}
        <div className="glass-card">
          <h2 className="text-sm font-bold mb-4 flex items-center gap-2 border-b border-border pb-3"><Database size={16} className="text-accent" /> Temel Veri Yükle (Excel)</h2>
          <p className="text-xs text-text-muted mb-4">Bilanço ve gelir tablosu verilerini .xlsx olarak yükleyin.</p>
          {uploadMsg.text && (
            <div className={`text-sm p-3 rounded-lg mb-3 ${uploadMsg.type === 'success' ? 'bg-green/10 text-green' : 'bg-red/10 text-red'}`}>{uploadMsg.text}</div>
          )}
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block uppercase tracking-wider">Hisse Kodu</label>
              <input value={ticker} onChange={(e) => setTicker(e.target.value)} required placeholder="GARAN" className="input-field uppercase" />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block uppercase tracking-wider">Excel Dosyası</label>
              <input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files[0])} required
                className="w-full text-sm text-text-muted file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-bg-card file:text-accent hover:file:bg-bg-card-hover cursor-pointer" />
            </div>
            <button type="submit" disabled={uploading} className="btn-primary w-full"><Upload size={14} /> Yükle</button>
          </form>
        </div>

        {/* Sync */}
        <div className="glass-card lg:col-span-2">
          <h2 className="text-sm font-bold mb-4 flex items-center gap-2 border-b border-border pb-3"><Download size={16} className="text-green" /> Yedekleme & Taşıma</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-text-secondary">Dışa Aktar</h3>
              <p className="text-xs text-text-muted">Portföy ve ayarlarınızı QR koduna dönüştürün.</p>
              <button onClick={handleExport} disabled={syncLoading} className="btn-outline w-full"><Copy size={14} /> QR Oluştur</button>
              {qrCode && <div className="mt-3 p-3 bg-white rounded-xl inline-block"><img src={qrCode} alt="QR" className="w-[180px] h-[180px]" /></div>}
            </div>
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-text-secondary">İçe Aktar</h3>
              <p className="text-xs text-text-muted">Dışa aktardığınız JSON verisini yapıştırın.</p>
              {importMsg && <div className="text-xs bg-accent/10 text-accent p-2 rounded-lg flex items-center gap-1"><CheckCircle size={14} /> {importMsg}</div>}
              <textarea rows="3" placeholder='{"portfolio":{...}}' value={importData} onChange={(e) => setImportData(e.target.value)} className="input-field resize-none" />
              <button onClick={handleImport} className="btn-outline w-full">Geri Yükle</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
