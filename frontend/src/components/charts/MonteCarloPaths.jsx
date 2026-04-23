// v6.0-F-NANSRADAR Gelistirme: Enhanced Realistic Visualization
import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, Area, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { Info, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

export function MonteCarloPaths({ predictions, representativePaths, currentPrice, confidenceLevels = [5, 25, 50, 75, 95], showStatistics = true }) {
  if (!predictions || predictions.length === 0) {
    return (
      <div className="w-full h-96 bg-gradient-to-br from-gray-900 to-gray-950 rounded-xl p-6 border border-white/10">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500/50 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-300 mb-2">Monte Carlo Simülasyon Verisi Yok</h3>
            <p className="text-sm text-slate-500">Tahmin verileri henüz yüklenmedi veya mevcut değil.</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate statistics for realistic risk bands
  const calculateStatistics = () => {
    const finalPrices = predictions.map(p => p[50] || p.median);
    const minPrice = Math.min(...finalPrices);
    const maxPrice = Math.max(...finalPrices);
    const avgPrice = finalPrices.reduce((a, b) => a + b, 0) / finalPrices.length;
    const stdDev = Math.sqrt(finalPrices.reduce((sq, n) => sq + Math.pow(n - avgPrice, 2), 0) / finalPrices.length);
    
    const positivePaths = finalPrices.filter(p => p > currentPrice).length;
    const negativePaths = finalPrices.filter(p => p < currentPrice).length;
    const neutralPaths = finalPrices.filter(p => Math.abs(p - currentPrice) / currentPrice < 0.02).length;

    return {
      probabilityUp: ((positivePaths / finalPrices.length) * 100).toFixed(1),
      probabilityDown: ((negativePaths / finalPrices.length) * 100).toFixed(1),
      expectedReturn: (((avgPrice - currentPrice) / currentPrice) * 100).toFixed(2),
      volatility: ((stdDev / avgPrice) * 100).toFixed(1),
      riskScore: Math.min(100, Math.max(0, 100 - (stdDev / avgPrice * 100))).toFixed(0),
      avgPrice: avgPrice.toFixed(2),
      minPrice: minPrice.toFixed(2),
      maxPrice: maxPrice.toFixed(2)
    };
  };

  const stats = calculateStatistics();
  const isBullish = parseFloat(stats.expectedReturn) > 0;

  const chartData = predictions.map((p, i) => ({
    day: i + 1,
    date: p.date,
    p5: p[5],
    p10: p[10],
    p25: p[25],
    p50: p[50] || p.median,
    p75: p[75],
    p90: p[90],
    p95: p[95],
    worst: representativePaths?.worst?.[i],
    best: representativePaths?.best?.[i],
    median: representativePaths?.median?.[i],
    p10Path: representativePaths?.p10?.[i],
    p90Path: representativePaths?.p90?.[i]
  }));

  const [hoveredPoint, setHoveredPoint] = useState(null);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900/95 backdrop-blur-sm border border-white/20 rounded-xl p-4 shadow-2xl">
          <div className="text-xs text-slate-400 mb-1">Gün {label}</div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-slate-300 text-xs">Mevcut Fiyat:</span>
              <span className="text-blue-400 font-mono font-bold">{currentPrice.toFixed(2)}</span>
            </div>
            {payload.map((entry, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="text-slate-300 text-xs" style={{ color: entry.color }}>
                  {entry.name}:
                </span>
                <span className="font-mono font-bold" style={{ color: entry.color }}>
                  {entry.value.toFixed(2)}
                </span>
              </div>
            ))}
            {hoveredPoint && (
              <div className="mt-2 pt-2 border-t border-white/10">
                <div className="text-[10px] text-slate-500">
                  {hoveredPoint.percentile && `%${hoveredPoint.percentile} güven aralığında`}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full bg-gradient-to-br from-gray-900 to-gray-950 rounded-xl p-6 border border-white/10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
            <TrendingUp className={`w-5 h-5 ${isBullish ? 'text-emerald-400' : 'text-rose-400'}`} />
            Monte Carlo Simülasyon Analizi
          </h3>
          <p className="text-sm text-slate-400">Regime-Switching GARCH + Historical Bootstrap ile gerçekçi risk bantları</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1 rounded-lg ${isBullish ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
            <span className="text-xs font-semibold">
              {isBullish ? '📈 Beklenen Getiri: ' : '📉 Beklenen Getiri: '}
              {stats.expectedReturn > 0 ? '+' : ''}{stats.expectedReturn}%
            </span>
          </div>
          <button className="p-2 hover:bg-white/5 rounded-lg transition-colors" title="Detaylı Bilgi">
            <Info className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Statistics Bar */}
      {showStatistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white/5 rounded-lg p-3 border border-white/5">
            <div className="text-xs text-slate-400 mb-1">Yükseliş Olasılığı</div>
            <div className="text-2xl font-bold text-emerald-400">{stats.probabilityUp}%</div>
            <div className="text-[10px] text-slate-500 mt-1">{stats.positivePaths} pozitif yol</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-white/5">
            <div className="text-xs text-slate-400 mb-1">Risk Skoru</div>
            <div className="text-2xl font-bold text-amber-400">{stats.riskScore}/100</div>
            <div className="text-[10px] text-slate-500 mt-1">Volatilite: {stats.volatility}%</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-white/5">
            <div className="text-xs text-slate-400 mb-1">Beklenen Fiyat</div>
            <div className="text-2xl font-bold text-purple-400">{stats.avgPrice}</div>
            <div className="text-[10px] text-slate-500 mt-1">Medyan tahmin</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-white/5">
            <div className="text-xs text-slate-400 mb-1">Fiyat Aralığı</div>
            <div className="text-lg font-bold text-cyan-400">{stats.minPrice} - {stats.maxPrice}</div>
            <div className="text-[10px] text-slate-500 mt-1">%95 güven aralığı</div>
          </div>
        </div>
      )}

      {/* Main Chart */}
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} onMouseMove={(e) => setHoveredPoint(e.activePayload?.[0]?.payload)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis 
              dataKey="day" 
              tickFormatter={(d) => `Gün ${d}`}
              stroke="#9ca3af"
              fontSize={12}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              domain={['auto', 'auto']} 
              stroke="#9ca3af"
              fontSize={12}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => value.toFixed(0)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="top" 
              height={36}
              wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }}
            />
            
            {/* Confidence Interval Areas */}
            <Area 
              type="monotone" 
              dataKey="p95" 
              stackId="1" 
              stroke="none" 
              fill="url(#colorHighConfidence)" 
              fillOpacity={0.3}
              name="%95 Güven Aralığı"
            />
            <Area 
              type="monotone" 
              dataKey="p75" 
              stackId="1" 
              stroke="none" 
              fill="url(#colorMediumConfidence)" 
              fillOpacity={0.4}
              name="%75 Güven Aralığı"
            />
            <Area 
              type="monotone" 
              dataKey="p50" 
              stackId="1" 
              stroke="none" 
              fill="url(#colorLowConfidence)" 
              fillOpacity={0.5}
              name="Medyan (P50)"
            />
            
            {/* Representative Paths */}
            <Line 
              type="monotone" 
              dataKey="p50" 
              stroke="#22c55e" 
              strokeWidth={3}
              dot={false}
              name="Medyan Yol"
              activeDot={{ r: 6, fill: '#22c55e', stroke: '#fff', strokeWidth: 2 }}
            />
            <Line 
              type="monotone" 
              dataKey="p10Path" 
              stroke="#3b82f6" 
              strokeWidth={1.5}
              strokeDasharray="3 3"
              dot={false}
              name="İyi Senaryo (P90)"
            />
            <Line 
              type="monotone" 
              dataKey="p90Path" 
              stroke="#ef4444" 
              strokeWidth={1.5}
              strokeDasharray="3 3"
              dot={false}
              name="Kötü Senaryo (P10)"
            />
            <Line 
              type="monotone" 
              dataKey="best" 
              stroke="#10b981" 
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
              name="En İyi Yol"
            />
            <Line 
              type="monotone" 
              dataKey="worst" 
              stroke="#ef4444" 
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
              name="En Kötü Yol"
            />
            
            <ReferenceLine 
              y={currentPrice} 
              stroke="#8b5cf6" 
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{ 
                value: 'Mevcut Fiyat', 
                position: 'right', 
                fill: '#8b5cf6',
                fontSize: 12,
                offset: 10
              }}
            />
            
            {/* Gradient Definitions */}
            <defs>
              <linearGradient id="colorHighConfidence" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorMediumConfidence" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorLowConfidence" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.5}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Legend */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span>Yükseliş Senaryosu (P > %{stats.probabilityUp})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500"></div>
            <span>Düşüş Senaryosu (P > %{stats.probabilityDown})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span>Risk Bantları (GARCH volatilite)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 border border-blue-400"></div>
            <span>Regime-Switching Model</span>
          </div>
        </div>
        <div className="mt-3 text-[10px] text-slate-500">
          <span className="text-amber-400">⚠️</span> Görselleştirme: Historical Bootstrap (50,000 simülasyon) + RS-GARCH volatilite modeli ile oluşturulmuştur.
        </div>
      </div>
    </div>
  );
}
