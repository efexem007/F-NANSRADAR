// v6.0-F-NANSRADAR Gelistirme
import React from 'react';

export function PredictionAccuracy({ validationResult }) {
  if (!validationResult) return null;

  const { p25p75Accuracy, p5p95Accuracy, avgError, totalTests } = validationResult;

  const getColor = (val) => val > 70 ? 'text-green-500' : val > 50 ? 'text-yellow-500' : 'text-red-500';
  const getBg = (val) => val > 70 ? 'bg-green-500' : val > 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="p-6 bg-gray-800 rounded-lg border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">Model Dogruluk Metrikleri</h3>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-300">P25-P75 Isabet (%50 Guven Araligi)</span>
            <span className={getColor(p25p75Accuracy)}>{p25p75Accuracy}%</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${getBg(p25p75Accuracy)}`} style={{ width: `${Math.min(p25p75Accuracy, 100)}%` }} />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-300">P5-P95 Isabet (%90 Guven Araligi)</span>
            <span className={getColor(p5p95Accuracy)}>{p5p95Accuracy}%</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${getBg(p5p95Accuracy)}`} style={{ width: `${Math.min(p5p95Accuracy, 100)}%` }} />
          </div>
        </div>

        <div className="flex justify-between text-sm pt-3 border-t border-gray-700">
          <span className="text-gray-400">Ortalama Hata</span>
          <span className="text-red-400">%{avgError}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Test Sayisi</span>
          <span className="text-gray-300">{totalTests}</span>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-4">
        * P25-P75 isabet orani %50'den yuksekse model kalibrasyonu dogrudur.<br/>
        * P5-P95 isabet orani %90 civarinda olmalidir.
      </p>
    </div>
  );
}
