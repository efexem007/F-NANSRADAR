import { useState, useEffect } from 'react';
import client from '../api/client';
import { Card } from '../components/ui/Card';
import { LoadingSpinner, ErrorAlert } from '../components/ui/Feedback';
import { formatNumber, formatDate } from '../utils/formatters';
import { BarChart2, Globe, Activity, TrendingDown } from 'lucide-react';

const Macro = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMacros();
  }, []);

  const fetchMacros = async () => {
    try {
      setLoading(true);
      const res = await client.get('/macro');
      setData(res.data);
    } catch (err) {
      setError('Makro göstergeler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const getIndicatorData = (type) => data.find(item => item.type === type) || null;

  const cds = getIndicatorData('CDS');
  const vix = getIndicatorData('VIX');
  const infl = getIndicatorData('ENFLASYON');
  const faiz = getIndicatorData('FAIZ');

  const IndicatorCard = ({ title, item, unit = '', icon: Icon, color, isNegativeRed = false }) => {
    if (!item) return (
      <Card className="flex flex-col opacity-60">
        <h3 className="text-gray-400 font-medium mb-2 flex items-center gap-2"><Icon size={18} /> {title}</h3>
        <p className="text-2xl font-bold mt-auto">Veri Yok</p>
      </Card>
    );

    // Some indicators (like inflation/cds) are bad when high
    let scoreColor = "text-white";
    if (color) {
      scoreColor = color;
    }

    return (
      <Card className="flex flex-col relative overflow-hidden group">
        <div className={`absolute top-0 right-0 w-32 h-32 bg-[${color || '#ffffff'}]/5 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-[${color || '#ffffff'}]/10 transition-colors pointer-events-none`}></div>
        <h3 className="text-gray-400 font-medium mb-1 flex items-center gap-2 relative z-10">
          <Icon size={18} className={color ? `text-[${color}]` : 'text-gray-400'} /> {title}
        </h3>
        <p className="text-sm text-gray-500 mb-4 relative z-10">Son Kayıt: {formatDate(item.date)}</p>
        <p className={`text-4xl font-bold mt-auto relative z-10 ${scoreColor}`}>
          {formatNumber(item.value)}<span className="text-xl text-gray-500 ml-1 font-normal">{unit}</span>
        </p>
      </Card>
    );
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <BarChart2 className="text-[#00ff88]" size={32} />
          Makro Göstergeler
        </h1>
      </div>

      <ErrorAlert message={error} />

      <p className="text-gray-400">
        Algoritmanın hisse sinyalleri üretirken temel aldığı ana ekonomik göstergelerin (CDS, VIX vb.) anlık durumunu buradan takip edebilirsiniz.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <IndicatorCard title="Türkiye CDS" item={cds} unit="bps" icon={Globe} color="#ff4757" />
        <IndicatorCard title="VIX (Korku)" item={vix} icon={Activity} color="#ffaa00" />
        <IndicatorCard title="Enflasyon (TÜFE)" item={infl} unit="%" icon={TrendingDown} color="#00d4ff" />
        <IndicatorCard title="TCMB Faiz" item={faiz} unit="%" icon={BarChart2} color="#00ff88" />
      </div>

      <Card className="min-h-[300px] mt-8 flex flex-col items-center justify-center border-dashed border-2 border-gray-700 bg-transparent">
         <Globe size={48} className="text-gray-600 mb-4" />
         <h3 className="text-lg font-medium text-gray-400">Tarihsel Grafik Eklenecek</h3>
         <p className="text-sm text-gray-500 mt-2 text-center max-w-sm">TCMB, VIX ve CDS için tarihsel karşılaştırma grafikleri yakında burada yerini alacak.</p>
      </Card>
    </div>
  );
};

export default Macro;
