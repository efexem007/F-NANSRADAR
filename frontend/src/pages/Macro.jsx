import { useState, useEffect } from 'react';
import client from '../api/client';
import { formatNumber, formatDate } from '../utils/formatters';
import { Globe, Activity, TrendingDown, BarChart2, ShieldAlert } from 'lucide-react';

const INDICATOR_META = {
  'CDS':       { label: 'Türkiye CDS', unit: 'bps', icon: ShieldAlert, color: 'red',    desc: '5 Yıllık CDS Spread — ülke riski' },
  'VIX':       { label: 'VIX (Korku)',  unit: '',    icon: Activity,    color: 'yellow', desc: 'Piyasa volatilite endeksi' },
  'ENFLASYON': { label: 'Enflasyon',    unit: '%',   icon: TrendingDown,color: 'accent', desc: 'TÜFE yıllık değişim oranı' },
  'FAIZ':      { label: 'TCMB Faiz',    unit: '%',   icon: BarChart2,   color: 'green',  desc: 'Merkez bankası politika faizi' },
};

const Macro = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try { setLoading(true); const res = await client.get('/macro'); setData(res.data); }
      catch { setError('Makro göstergeler yüklenemedi.'); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Globe size={24} className="text-green" /> Makro Göstergeler</h1>
        <p className="text-sm text-text-muted mt-1">Algoritmanın sinyal üretirken temel aldığı ekonomik göstergeler</p>
      </div>

      {error && <div className="bg-red/10 border border-red/20 text-red text-sm p-3 rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(INDICATOR_META).map(([type, meta]) => {
          const item = data.find(d => d.type === type);
          const Icon = meta.icon;
          return (
            <div key={type} className={`glass-card stat-card ${meta.color} group relative overflow-hidden`}>
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{meta.label}</p>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${meta.color}/10`}>
                  <Icon size={18} className={`text-${meta.color}`} />
                </div>
              </div>
              {item ? (
                <>
                  <p className="text-3xl font-bold mb-1">{formatNumber(item.value)}<span className="text-base text-text-muted ml-1 font-normal">{meta.unit}</span></p>
                  <p className="text-[11px] text-text-muted">{meta.desc}</p>
                  <p className="text-[11px] text-text-muted mt-1">Son: {formatDate(item.date)}</p>
                </>
              ) : (
                <p className="text-xl font-bold text-text-muted">Veri Yok</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="glass-card flex flex-col items-center justify-center py-16 border-dashed border-2 border-border !bg-transparent">
        <Globe size={40} className="text-text-muted opacity-20 mb-3" />
        <h3 className="font-semibold text-text-secondary">Tarihsel Karşılaştırma</h3>
        <p className="text-xs text-text-muted mt-1 text-center max-w-sm">CDS, VIX ve faiz için tarihsel trend grafikleri gelecek sürümde eklenecek.</p>
      </div>
    </div>
  );
};

export default Macro;
