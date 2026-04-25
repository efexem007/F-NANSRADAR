import { Globe, TrendingUp, TrendingDown, Percent, DollarSign, AlertTriangle, Shield } from 'lucide-react';

interface MacroIndicator {
  name: string;
  value: string;
  change: number;
  icon: React.ElementType;
  color: string;
}

const macroData: MacroIndicator[] = [
  { name: 'Türkiye CDS', value: '285', change: -2.5, icon: Shield, color: 'text-emerald-400' },
  { name: 'VIX (Korku)', value: '18.45', change: 3.2, icon: AlertTriangle, color: 'text-amber-400' },
  { name: 'Faiz (Politika)', value: '%50', change: 0, icon: Percent, color: 'text-cyan-400' },
  { name: 'Enflasyon', value: '%44.4', change: -1.2, icon: TrendingDown, color: 'text-emerald-400' },
  { name: 'Rezerv', value: '$165B', change: 0.8, icon: DollarSign, color: 'text-violet-400' },
  { name: 'Büyüme', value: '%3.2', change: 0.5, icon: TrendingUp, color: 'text-emerald-400' },
];

export const MacroPanel = () => {
  return (
    <section className="py-8">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-white">Makro Ekonomik Veriler</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {macroData.map((item) => (
            <div
              key={item.name}
              className="rounded-2xl bg-[#111827] border border-white/[0.06] p-4 hover:border-white/10 transition-all group"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={`p-1.5 rounded-lg bg-white/5`}>
                  <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                </div>
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{item.name}</span>
              </div>
              <p className="text-lg font-bold text-white font-mono">{item.value}</p>
              <div
                className={`flex items-center gap-1 mt-1 text-xs font-semibold ${
                  item.change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {item.change >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {item.change >= 0 ? '+' : ''}
                {item.change}%
              </div>
            </div>
          ))}
        </div>

        {/* Risk Warning */}
        <div className="mt-5 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15 shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-amber-400 mb-1">Makro Risk Değerlendirmesi</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                CDS primlerindeki gerileme ve faiz indirim beklentileri piyasaları destekliyor. 
                Ancak küresel belirsizlikler ve jeopolitik riskler nedeniyle dikkatli olunmalı. 
                Portföy çeşitlendirmesi ve stop-loss stratejileri önerilir.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
