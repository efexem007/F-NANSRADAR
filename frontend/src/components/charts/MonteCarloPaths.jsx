// v6.0-F-NANSRADAR Gelistirme
import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, Area, ResponsiveContainer } from 'recharts';

export function MonteCarloPaths({ predictions, representativePaths, currentPrice }) {
  if (!predictions || predictions.length === 0) return null;

  const chartData = predictions.map((p, i) => ({
    date: p.date,
    p5: p[5],
    p25: p[25],
    p50: p[50] || p.median,
    p75: p[75],
    p95: p[95],
    worst: representativePaths?.worst?.[i],
    best: representativePaths?.best?.[i],
    median: representativePaths?.median?.[i]
  }));

  return (
    <div className="w-full h-96 bg-gray-900 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Monte Carlo Simulasyon Yollari</h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData}>
          <XAxis 
            dataKey="date" 
            tickFormatter={(d) => d.slice(5)}
            stroke="#9ca3af"
          />
          <YAxis domain={['auto', 'auto']} stroke="#9ca3af" />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
            formatter={(v) => [v?.toFixed(2), '']}
          />
          <Area type="monotone" dataKey="p95" stroke="none" fill="#22c55e" fillOpacity={0.1} />
          <Area type="monotone" dataKey="p5" stroke="none" fill="#ffffff" fillOpacity={0} />
          <Area type="monotone" dataKey="p75" stroke="none" fill="#22c55e" fillOpacity={0.2} />
          <Area type="monotone" dataKey="p25" stroke="none" fill="#ffffff" fillOpacity={0} />
          <Line type="monotone" dataKey="p50" stroke="#22c55e" strokeWidth={2} name="Medyan" dot={false} />
          <Line type="monotone" dataKey="worst" stroke="#ef4444" strokeDasharray="5 5" strokeWidth={1} name="En Kotu" dot={false} />
          <Line type="monotone" dataKey="best" stroke="#22c55e" strokeDasharray="5 5" strokeWidth={1} name="En Iyi" dot={false} />
          <ReferenceLine 
            y={currentPrice} 
            stroke="#3b82f6" 
            strokeDasharray="3 3"
            label={{ value: 'Mevcut', position: 'right', fill: '#3b82f6' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
