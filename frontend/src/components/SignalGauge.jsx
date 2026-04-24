// v6.0-F-NANSRADAR Gelistirme
import React from 'react';

export function SignalGauge({ score, signal }) {
  const rotation = (score / 100) * 180 - 90;
  const color = score > 70 ? '#22c55e' : score > 50 ? '#fbbf24' : score > 30 ? '#f97316' : '#ef4444';

  return (
    <div className="relative w-48 h-28 mx-auto">
      <svg viewBox="0 0 200 100" className="w-full h-full">
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#374151" strokeWidth="20" />
        <path 
          d="M 20 100 A 80 80 0 0 1 180 100" 
          fill="none" 
          stroke={color} 
          strokeWidth="20"
          strokeDasharray={`${(score / 100) * 251} 251`}
        />
        <line 
          x1="100" y1="100" x2="100" y2="30"
          stroke="#fff" strokeWidth="3"
          transform={`rotate(${rotation} 100 100)`}
        />
        <circle cx="100" cy="100" r="5" fill="#fff" />
      </svg>
      <div className="text-center mt-1">
        <div className="text-2xl font-bold" style={{ color }}>{score}/100</div>
        <div className="text-sm text-gray-400">{signal}</div>
      </div>
    </div>
  );
}
