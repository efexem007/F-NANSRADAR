import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';

const sampleData = [
  { signalType: 'GÜÇLÜ AL', accuracy1g: 78, accuracy5g: 82, accuracy21g: 85 },
  { signalType: 'AL', accuracy1g: 65, accuracy5g: 70, accuracy21g: 72 },
  { signalType: 'SAT', accuracy1g: 58, accuracy5g: 62, accuracy21g: 60 },
];

export default function SignalAccuracyChart({ data = sampleData }) {
  const formatData = data.map(item => ({
    ...item,
    accuracy1g: item.accuracy1g / 100,
    accuracy5g: item.accuracy5g / 100,
    accuracy21g: item.accuracy21g / 100,
  }));

  const getBarColor = (value) => {
    const percent = value * 100;
    if (percent > 60) return '#10b981';
    if (percent > 45) return '#fbbf24';
    return '#ef4444';
  };

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="signalType" stroke="#9ca3af" />
          <YAxis
            stroke="#9ca3af"
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            domain={[0, 1]}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#4b5563' }}
            formatter={(value) => `${(value * 100).toFixed(1)}%`}
          />
          <Legend />
          {/* 1 Gün */}
          <Bar
            dataKey="accuracy1g"
            name="1 Gün"
            fill={getBarColor(formatData[0]?.accuracy1g * 100)}
            radius={[4, 4, 0, 0]}
          >
            <LabelList
              dataKey="accuracy1g"
              position="top"
              formatter={(v) => `${(v * 100).toFixed(0)}%`}
              fill="#fff"
              fontSize={12}
            />
          </Bar>
          {/* 5 Gün */}
          <Bar
            dataKey="accuracy5g"
            name="5 Gün"
            fill={getBarColor(formatData[0]?.accuracy5g * 100)}
            radius={[4, 4, 0, 0]}
          >
            <LabelList
              dataKey="accuracy5g"
              position="top"
              formatter={(v) => `${(v * 100).toFixed(0)}%`}
              fill="#fff"
              fontSize={12}
            />
          </Bar>
          {/* 21 Gün */}
          <Bar
            dataKey="accuracy21g"
            name="21 Gün"
            fill={getBarColor(formatData[0]?.accuracy21g * 100)}
            radius={[4, 4, 0, 0]}
          >
            <LabelList
              dataKey="accuracy21g"
              position="top"
              formatter={(v) => `${(v * 100).toFixed(0)}%`}
              fill="#fff"
              fontSize={12}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Referans çizgisi */}
      <div className="mt-2 text-center text-sm text-slate-500">
        %50 referans çizgisi (yeşil &gt; %60, sarı &gt; %45, kırmızı &lt; %45)
      </div>
    </div>
  );
}
