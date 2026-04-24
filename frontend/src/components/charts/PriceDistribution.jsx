// v6.0-F-NANSRADAR Gelistirme
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';

export function PriceDistribution({ distribution, currentPrice, targetPrice }) {
  if (!distribution || distribution.length === 0) return null;

  return (
    <div className="w-full h-80 bg-gray-900 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Fiyat Olasilik Dagilimi</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={distribution}>
          <XAxis 
            dataKey="price" 
            tickFormatter={(v) => `${v.toFixed(2)}`}
            stroke="#9ca3af"
          />
          <YAxis stroke="#9ca3af" />
          <Tooltip 
            formatter={(v) => [`%${v}`, 'Olasilik']}
            contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
          />
          <ReferenceLine 
            x={currentPrice} 
            stroke="#3b82f6" 
            strokeDasharray="3 3"
            label={{ value: 'Mevcut', position: 'top', fill: '#3b82f6' }}
          />
          <ReferenceLine 
            x={targetPrice} 
            stroke="#22c55e" 
            strokeDasharray="3 3"
            label={{ value: 'Hedef', position: 'top', fill: '#22c55e' }}
          />
          <Bar dataKey="probability" fill="#6366f1" opacity={0.7} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
