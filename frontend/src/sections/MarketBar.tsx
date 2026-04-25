import type { MarketIndex } from '@/types';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MarketBarProps {
  indices: MarketIndex[];
}

export const MarketBar = ({ indices }: MarketBarProps) => {
  return (
    <section className="py-4 border-y border-white/5 bg-white/[0.02]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {indices.map((index) => (
            <div
              key={index.name}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 transition-all"
            >
              <div className="flex flex-col">
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                  {index.name}
                </span>
                <span className="text-xs font-semibold text-white font-mono">
                  {index.name.includes('TRY') ? index.value.toFixed(2) : index.name === 'BTC' ? index.value.toLocaleString('tr-TR', {maximumFractionDigits:0}) : index.value.toLocaleString('tr-TR', {maximumFractionDigits:1})}
                </span>
              </div>
              <div
                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                  index.change >= 0
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-rose-500/15 text-rose-400'
                }`}
              >
                {index.change >= 0 ? (
                  <TrendingUp className="w-2.5 h-2.5" />
                ) : (
                  <TrendingDown className="w-2.5 h-2.5" />
                )}
                {index.change >= 0 ? '+' : ''}
                {index.change.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
