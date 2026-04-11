import { useState, useContext } from 'react';
import client from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ErrorAlert } from '../components/ui/Feedback';
import { Settings as SettingsIcon, Upload, Download, Copy, CheckCircle, Database } from 'lucide-react';

const Settings = () => {
  const { user } = useContext(AuthContext);
  
  // Excel Upload State
  const [ticker, setTicker] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState({ type: '', text: '' });

  // Sync State
  const [qrCode, setQrCode] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [importData, setImportData] = useState('');
  const [importMsg, setImportMsg] = useState('');

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!ticker || !file) return;
    
    setUploading(true);
    setUploadMsg({ type: '', text: '' });
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      await client.post(`/upload/fundamental/${ticker.toUpperCase()}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadMsg({ type: 'success', text: `${ticker.toUpperCase()} için temel veriler başarıyla yüklendi.` });
      setTicker('');
      setFile(null);
    } catch (err) {
      setUploadMsg({ type: 'error', text: err.response?.data?.error || 'Yükleme hatası' });
    } finally {
      setUploading(false);
    }
  };

  const handleExport = async () => {
    try {
      setSyncLoading(true);
      const res = await client.get('/sync/export');
      setQrCode(res.data.qrCode);
    } catch (err) {
      console.error(err);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importData) return;
    try {
      setSyncLoading(true);
      await client.post('/sync/import', { data: importData });
      setImportMsg('Portföy başarıyla içe aktarıldı!');
      setImportData('');
    } catch (err) {
      setImportMsg('İçe aktarma hatası. Verinin geçerli formatta olduğuna emin olun.');
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <SettingsIcon className="text-gray-400" size={32} />
          Uygulama Ayarları
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Profil Kartı */}
        <Card className="flex flex-col">
          <h2 className="text-xl font-bold mb-4 border-b border-[rgba(255,255,255,0.05)] pb-2 pr-4 inline-block">Profil Bilgileri</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Ad Soyad</p>
              <p className="font-medium text-lg">{user?.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">E-posta Adresi</p>
              <p className="font-medium text-lg">{user?.email || '-'}</p>
            </div>
          </div>
        </Card>

        {/* Veri Yükleme */}
        <Card>
          <h2 className="text-xl font-bold mb-4 border-b border-[rgba(255,255,255,0.05)] pb-2 flex items-center gap-2">
            <Database size={20} className="text-[#00d4ff]" /> Temel Veri Yükle (Excel)
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Bilanço ve gelir tablosu verilerini, sistemin okuyabileceği formatta Excel (.xlsx) olarak yükleyin. 
            Otomatik oran analizi yapılacaktır.
          </p>
          
          {uploadMsg.text && (
            <div className={`p-3 rounded mb-4 text-sm ${uploadMsg.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
               {uploadMsg.text}
            </div>
          )}

          <form onSubmit={handleUpload} className="space-y-4">
            <Input 
              label="Hisse Kodu (Örn: GARAN)" 
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              required
              className="uppercase"
            />
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1.5 block">Excel Dosyası</label>
              <input 
                type="file" 
                accept=".xlsx, .xls"
                onChange={(e) => setFile(e.target.files[0])}
                className="w-full text-sm text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#1a2141] file:text-[#00d4ff] hover:file:bg-[#20284f] focus:outline-none cursor-pointer"
                required
              />
            </div>
            <Button type="submit" loading={uploading} className="w-full gap-2">
              <Upload size={18} /> Yükle ve Analiz Et
            </Button>
          </form>
        </Card>

        {/* Veri Senkronizasyonu */}
        <Card className="lg:col-span-2">
          <h2 className="text-xl font-bold mb-4 border-b border-[rgba(255,255,255,0.05)] pb-2 flex items-center gap-2">
            <Download size={20} className="text-[#00ff88]" /> Yedekleme ve Taşıma (QR)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="font-medium text-gray-300">Dışa Aktar</h3>
              <p className="text-sm text-gray-400">Portföyünüzü ve ayarlarınızı güvenli şekilde QR koda (JSON şifreli) dönüştürerek saklayabilirsiniz.</p>
              <Button onClick={handleExport} loading={syncLoading} variant="outline" className="w-full gap-2">
                <Copy size={18} /> Dışa Aktar (QR Oluştur)
              </Button>
              {qrCode && (
                <div className="mt-4 p-4 bg-white rounded-xl inline-block">
                  <img src={qrCode} alt="Backup QR Code" className="w-[200px] h-[200px]" />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-gray-300">İçe Aktar</h3>
              <p className="text-sm text-gray-400">Daha önce dışa aktardığınız metin verisini (JSON formunu) buraya yapıştırın.</p>
              
              {importMsg && (
                <div className="p-2 bg-[#1a2141] rounded text-[#00d4ff] text-sm flex gap-2">
                  <CheckCircle size={16} /> {importMsg}
                </div>
              )}
              
              <Input 
                as="textarea"
                rows="4" 
                placeholder='{"portfolio": {...}}'
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
              />
              <Button onClick={handleImport} variant="secondary" className="w-full">Geri Yükle</Button>
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
};

export default Settings;
