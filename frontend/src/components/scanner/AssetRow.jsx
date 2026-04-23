// v6.0-F-NANSRADAR Gelistirme: AssetRow component refactoring
import React from 'react';
import { Star, StarOff, ArrowUpRight, ArrowDownRight, X } from 'lucide-react';

const SIGNAL_COLORS = {
  'GÜÇLÜ AL': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'AL': { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30' },
  'BEKLE': { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  'SAT': { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  'GÜÇLÜ SAT': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
};

function ChangeBadge({ value, small = false }) {
  if (value == null) return null;
  const positive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono font-bold ${small ? 'text-[10px]' : 'text-xs'} ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
      {positive ? <ArrowUpRight size={small ? 10 : 12} /> : <ArrowDownRight size={small ? 10 : 12} />}
      {positive ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
}

function formatPrice(price, type) {
  if (price == null) return '—';
  if (type === 'crypto' && price > 100) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (type === 'crypto') return `$${price.toFixed(2)}`;
  if (type === 'forex') return price.toFixed(4);
  if (type === 'commodity') return `$${price.toFixed(2)}`;
  return `₺${price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AssetRow({ asset, onWatch, isWatched, onNavigate, isSelected, onSelect }) {
  const sc = SIGNAL_COLORS[asset.signal] || SIGNAL_COLORS['BEKLE'];

  return (
    <tr
      className={`group cursor-pointer hover:bg-white/3 transition-colors border-b border-white/3 ${isSelected ? 'bg-purple-500/5' : ''}`}
      onClick={() => onNavigate(asset)}
    >
      {/* Checkbox */}
      <td className="py-2.5 px-2" onClick={(e) => e.stopPropagation()}>
        <input 
          type="checkbox" 
          checked={isSelected}
          onChange={() => onSelect(asset.symbol)}
          className="w-3.5 h-3.5 rounded border-white/10 bg-white/5 text-purple-600 focus:ring-offset-0 focus:ring-purple-500"
        />
      </td>

      {/* Symbol + Name */}
      <td className="py-2.5 px-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">{asset.flag}</span>
          <div>
            <div className="text-xs font-bold text-white">{asset.symbol.replace('.IS','').replace('=X','').replace('-USD','')}</div>
            <div className="text-[10px] text-slate-500 truncate max-w-[120px]">{asset.name}</div>
          </div>
        </div>
      </td>

      {/* Price */}
      <td className="py-2.5 px-2 text-right">
        <div className="text-xs font-mono font-bold text-white">{formatPrice(asset.currentPrice, asset.type)}</div>
      </td>

      {/* Change 1D */}
      <td className="py-2.5 px-2 text-right">
        <ChangeBadge value={asset.change1d} small />
      </td>

      {/* Change 7D */}
      <td className="py-2.5 px-2 text-right hidden md:table-cell">
        <ChangeBadge value={asset.change7d} small />
      </td>

      {/* Signal */}
      <td className="py-2.5 px-2 text-center">
        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${sc.bg} ${sc.text} ${sc.border}`}>
          {asset.signal}
        </span>
      </td>

      {/* Score */}
      <td className="py-2.5 px-2 text-center hidden lg:table-cell">
        <div className="flex items-center justify-center gap-1">
          <div className="w-10 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${asset.opportunityScore}%`,
                background: asset.opportunityScore >= 70 ? '#22c55e' : asset.opportunityScore >= 50 ? '#eab308' : '#ef4444'
              }}
            />
          </div>
          <span className="text-xs font-mono text-slate-300 w-6">{asset.opportunityScore}</span>
        </div>
      </td>

      {/* RSI */}
      <td className="py-2.5 px-2 text-center hidden xl:table-cell">
        <span className={`text-[10px] font-mono ${
          asset.indicators?.rsi < 30 ? 'text-emerald-400' :
          asset.indicators?.rsi > 70 ? 'text-rose-400' : 'text-slate-400'
        }`}>
          {asset.indicators?.rsi ?? '—'}
        </span>
      </td>

      {/* Volatility */}
      <td className="py-2.5 px-2 text-center hidden xl:table-cell">
        <span className="text-[10px] font-mono text-slate-400">{asset.volatility ? `%${asset.volatility}` : '—'}</span>
      </td>

      {/* Watch */}
      <td className="py-2.5 px-2 text-center">
        <button
          onClick={(e) => { e.stopPropagation(); onWatch(asset); }}
          className="p-1 rounded-md hover:bg-white/5 transition-colors"
        >
          {isWatched ? <Star size={14} className="text-amber-400 fill-amber-400" /> : <StarOff size={14} className="text-slate-600 hover:text-amber-400" />}
        </button>
      </td>
    </tr>
  );
}