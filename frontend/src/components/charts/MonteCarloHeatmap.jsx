// v6.0-F-NANSRADAR Gelistirme
import React, { useMemo } from 'react';
import { scaleLinear } from 'd3-scale';

export function MonteCarloHeatmap({ predictions, currentPrice }) {
  const data = useMemo(() => {
    if (!predictions || predictions.length === 0) return { cells: [], percentiles: [], days: 0 };
    const days = predictions.length;
    const percentiles = Object.keys(predictions[0])
      .filter(k => !isNaN(k))
      .map(Number)
      .sort((a, b) => a - b);

    const cells = [];
    predictions.forEach((day, dayIdx) => {
      percentiles.forEach(pct => {
        cells.push({
          day: dayIdx,
          percentile: pct,
          price: day[pct],
          value: ((day[pct] - currentPrice) / currentPrice) * 100
        });
      });
    });
    return { cells, percentiles, days };
  }, [predictions, currentPrice]);

  const colorScale = scaleLinear()
    .domain([-20, 0, 20])
    .range(['#ef4444', '#fbbf24', '#22c55e']);

  return (
    <div className="w-full h-96 relative bg-gray-900 rounded-lg overflow-hidden">
      <h3 className="text-lg font-semibold text-white p-4 pb-2">Monte Carlo Isi Haritasi</h3>
      <svg viewBox={`0 0 ${data.days} 100`} className="w-full h-72 px-4">
        {data.cells?.map((cell, i) => (
          <rect
            key={i}
            x={cell.day}
            y={100 - cell.percentile}
            width={1}
            height={1}
            fill={colorScale(cell.value)}
            opacity={0.85}
          />
        ))}
      </svg>
      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-400 px-4 pb-2">
        <span>Bugun</span>
        <span>Hedef Tarih</span>
      </div>
      <div className="flex justify-center gap-4 text-xs mt-2">
        <span className="text-red-400">◼ %20 Kayip</span>
        <span className="text-yellow-400">◼ Nötr</span>
        <span className="text-green-400">◼ %20 Kazanc</span>
      </div>
    </div>
  );
}
