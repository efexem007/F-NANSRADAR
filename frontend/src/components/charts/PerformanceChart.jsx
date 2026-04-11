import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { STOCK_COLORS } from '../../constants/colors'
import ChartTooltip from '../ChartTooltip'

export default function PerformanceChart({ data, tickers, logScale }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} syncId="finansradar">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} />
        <YAxis scale={logScale ? 'log' : 'auto'} domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 10 }} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        {tickers.map(ticker => (
          <Line key={ticker} type="monotone" dataKey={ticker}
            stroke={STOCK_COLORS[ticker] || STOCK_COLORS.DEFAULT}
            strokeWidth={2} dot={{ r: 2, fill: STOCK_COLORS[ticker] || STOCK_COLORS.DEFAULT }}
            activeDot={{ r: 6 }} animationBegin={0} animationDuration={1500} animationEasing="ease-out" />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
