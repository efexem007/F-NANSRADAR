import { memo } from 'react'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend, ResponsiveContainer } from 'recharts'
import { STOCK_COLORS } from '../../constants/colors'

export default memo(function VolatilityRadar({ data, tickers }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={data}>
        <PolarGrid stroke="rgba(255,255,255,0.1)" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
        {tickers.map(ticker => (
          <Radar key={ticker} name={ticker} dataKey={ticker}
            stroke={STOCK_COLORS[ticker] || '#94a3b8'} fill={STOCK_COLORS[ticker] || '#94a3b8'}
            fillOpacity={0.1} isAnimationActive={false} />
        ))}
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </RadarChart>
    </ResponsiveContainer>
  )
})
