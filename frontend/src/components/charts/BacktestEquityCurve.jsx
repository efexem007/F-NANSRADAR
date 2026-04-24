import React from 'react';
import { ResponsiveContainer, ComposedChart, Line, Area, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const sampleEquity = [
  { date: '2025-01', capital: 10000, drawdown: 0, isWin: null },
  { date: '2025-02', capital: 10500, drawdown: 0, isWin: true },
  { date: '2025-03', capital: 9800, drawdown: 6.7, isWin: false },
  { date: '2025-04', capital: 11000, drawdown: 0, isWin: true },
  { date: '2025-05', capital: 10800, drawdown: 1.8, isWin: false },
  { date: '2025-06', capital: 11500, drawdown: 0, isWin: true },
  { date: '2025-07', capital: 11200, drawdown: 2.6, isWin: false },
  { date: '2025-08', capital: 12000, drawdown: 0, isWin: true },
];

export default function BacktestEquityCurve({ data = sampleEquity }) {
  // Başlangıç sermayesi referans çizgisi
  const startCapital = data.length > 0 ? data[0].capital : 10000;

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" tickFormatter={(v) => `$${v}`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#4b5563' }}
            formatter={(value, name) => {
              if (name === 'capital') return [value.toFixed(0), 'Sermaye'];
              if (name === 'drawdown') return [value.toFixed(1) + '%', 'Drawdown'];
              return value;
            }}
          />
          <Legend />
          {/* Başlangıç sermayesi referans çizgisi */}
          <Line
            type="monotone"
            dataKey={() => startCapital}
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="Başlangıç"
          />
          {/* Equity curve */}
          <Line
            type="monotone"
            dataKey="capital"
            stroke="#22c55e"
            strokeWidth={3}
            dot={false}
            name="Sermaye"
          />
          {/* Drawdown alanı */}
          <Area
            type="monotone"
            dataKey="drawdown"
            fill="#ef4444"
            stroke="#ef4444"
            fillOpacity={0.3}
            strokeWidth={1}
            name="Drawdown %"
          />
          {/* Win trades */}
          <Scatter
            data={data.filter(d => d.isWin === true)}
            dataKey="capital"
            fill="#10b981"
            stroke="#fff"
            strokeWidth={1}
            name="Kazanç"
            shape="circle"
            r={5}
          />
          {/* Loss trades */}
          <Scatter
            data={data.filter(d => d.isWin === false)}
            dataKey="capital"
            fill="#ef4444"
            stroke="#fff"
            strokeWidth={1}
            name="Kayıp"
            shape="circle"
            r={5}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
