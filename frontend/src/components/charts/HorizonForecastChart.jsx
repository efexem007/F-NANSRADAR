import React from 'react';
import { Card } from '../ui/Card.jsx';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LabelList } from 'recharts';

const horizonDataExample = [
  { key: '1G', label: '1 Gün', price: 150.2, p5: 148.1, p95: 152.8, probUp: 65, probDown: 15, signal: 'AL' },
  { key: '3G', label: '3 Gün', price: 151.5, p5: 147.3, p95: 155.0, probUp: 68, probDown: 12, signal: 'AL' },
  { key: '5G', label: '1 Hafta', price: 152.8, p5: 146.5, p95: 158.2, probUp: 70, probDown: 10, signal: 'AL' },
  { key: '10G', label: '2 Hafta', price: 154.0, p5: 145.8, p95: 161.5, probUp: 72, probDown: 8, signal: 'AL' },
  { key: '1A', label: '1 Ay', price: 158.3, p5: 143.2, p95: 168.9, probUp: 75, probDown: 6, signal: 'GÜÇLÜ AL' },
  { key: '3A', label: '3 Ay', price: 165.7, p5: 138.5, p95: 180.1, probUp: 78, probDown: 5, signal: 'AL' },
  { key: '6A', label: '6 Ay', price: 172.4, p5: 135.0, p95: 195.3, probUp: 80, probDown: 4, signal: 'BEKLE' },
  { key: '1Y', label: '1 Yıl', price: 185.6, p5: 128.9, p95: 215.8, probUp: 82, probDown: 3, signal: 'SAT' },
];

export default function HorizonForecastChart({ data = horizonDataExample }) {
  const getSignalColor = (signal) => {
    switch(signal) {
      case 'GÜÇLÜ AL': return '#10b981';
      case 'AL': return '#3b82f6';
      case 'BEKLE': return '#f59e0b';
      case 'SAT': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {data.map((item) => (
        <Card key={item.key} className="p-4">
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-white">{item.label}</h3>
              <span className="text-xs px-2 py-1 rounded-full text-white"
                style={{ backgroundColor: getSignalColor(item.signal) }}>
                {item.signal}
              </span>
            </div>
            <div className="text-2xl font-bold text-white">{item.price.toFixed(2)}</div>
            <div className="text-sm text-slate-400 mt-1">
              %{item.probUp} Yukarı / %{item.probDown} Aşağı
            </div>
            <div className="mt-3">
              <div className="text-xs text-slate-500">Güven Aralığı</div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{item.p5.toFixed(1)}</span>
                <span className="text-slate-400">-</span>
                <span className="text-slate-300">{item.p95.toFixed(1)}</span>
              </div>
            </div>
            {/* Mini bar chart */}
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={40}>
                <BarChart data={[item]} layout="vertical">
                  <XAxis type="number" hide domain={[item.p5, item.p95]} />
                  <YAxis type="category" hide />
                  <Bar dataKey="price" fill={getSignalColor(item.signal)} radius={3} barSize={20}>
                    <LabelList dataKey="price" position="insideRight" fill="#fff" fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
