import { TrendingUp, ArrowDownRight, Activity, BarChart3, DollarSign, AlertTriangle } from 'lucide-react';

interface KpiCardsProps {
  topGainers: { code: string; change: number }[];
  topLosers: { code: string; change: number }[];
  strongestSignals: { code: string; signalScore: number }[];
}

export const KpiCards = ({ strongestSignals }: KpiCardsProps) => {
  const cards = [
    {
      title: 'En Yüksek Hacim',
      value: 'THYAO',
      sub: '+2.45%',
      icon: BarChart3,
      color: 'from-violet-500/20 to-violet-600/10',
      textColor: 'text-violet-400',
    },
    {
      title: 'En Yüksek Fiyat',
      value: 'KONTR',
      sub: '₦845.20',
      icon: DollarSign,
      color: 'from-cyan-500/20 to-cyan-600/10',
      textColor: 'text-cyan-400',
    },
    {
      title: 'En Düşük Fiyat',
      value: 'KRDMD',
      sub: '₦12.85',
      icon: ArrowDownRight,
      color: 'from-emerald-500/20 to-emerald-600/10',
      textColor: 'text-emerald-400',
    },
    {
      title: 'Toplam Piyasa',
      value: '12.4T ₺',
      sub: '+0.85%',
      icon: Activity,
      color: 'from-amber-500/20 to-amber-600/10',
      textColor: 'text-amber-400',
    },
    {
      title: 'En Güçlü Sinyal',
      value: strongestSignals[0]?.code || 'THYAO',
      sub: `Skor: ${strongestSignals[0]?.signalScore || 87}`,
      icon: TrendingUp,
      color: 'from-emerald-500/20 to-emerald-600/10',
      textColor: 'text-emerald-400',
    },
    {
      title: 'En Zayıf Sinyal',
      value: strongestSignals[strongestSignals.length - 1]?.code || 'KRDMD',
      sub: `Skor: ${strongestSignals[strongestSignals.length - 1]?.signalScore || 23}`,
      icon: AlertTriangle,
      color: 'from-rose-500/20 to-rose-600/10',
      textColor: 'text-rose-400',
    },
  ];

  return (
    <section className="py-8">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-violet-400" />
          Özet Göstergeler
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {cards.map((card) => (
            <div
              key={card.title}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.color} border border-white/5 p-4 hover:border-white/10 transition-all cursor-default group`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-xl bg-white/5 ${card.textColor}`}>
                  <card.icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                  {card.title}
                </span>
              </div>
              <p className="text-xl font-bold text-white font-mono">{card.value}</p>
              <p className={`text-xs font-medium mt-1 ${card.textColor}`}>{card.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
