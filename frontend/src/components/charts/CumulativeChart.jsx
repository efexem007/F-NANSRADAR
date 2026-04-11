import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { STOCK_COLORS } from '../../constants/colors'

export default function CumulativeChart({ data, tickers }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} syncId="finansradar">
        <defs>
          {tickers.map(ticker => (
            <linearGradient key={ticker} id={`grad_${ticker}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={STOCK_COLORS[ticker] || '#94a3b8'} stopOpacity={0.3} />
              <stop offset="95%" stopColor={STOCK_COLORS[ticker] || '#94a3b8'} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} />
        <YAxis tickFormatter={v => `${v}%`} tick={{ fill: '#64748b', fontSize: 10 }} />
        <Tooltip formatter={v => `${typeof v === 'number' ? v.toFixed(1) : v}%`}
          contentStyle={{ background: '#1a1a35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
          labelStyle={{ color: '#94a3b8' }} />
        {tickers.map(ticker => (
          <Area key={ticker} type="monotone" dataKey={ticker}
            stroke={STOCK_COLORS[ticker] || '#94a3b8'} strokeWidth={2}
            fill={`url(#grad_${ticker})`} animationDuration={1500} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
