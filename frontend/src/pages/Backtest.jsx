import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import HorizonForecastChart from '../components/charts/HorizonForecastChart.jsx';
import BacktestEquityCurve from '../components/charts/BacktestEquityCurve.jsx';
import SignalAccuracyChart from '../components/charts/SignalAccuracyChart.jsx';
import client from '../api/client';

export default function Backtest() {
  const { symbol: paramSymbol } = useParams();
  const [symbol, setSymbol] = useState(paramSymbol || 'GARAN');
  const [period, setPeriod] = useState('ALL');
  const [holdingPeriod, setHoldingPeriod] = useState(5);
  const [stopLoss, setStopLoss] = useState(8);
  const [takeProfit, setTakeProfit] = useState(15);
  const [loading, setLoading] = useState(false);
  const [forecastData, setForecastData] = useState(null);
  const [backtestResult, setBacktestResult] = useState(null);
  const [riskMetrics, setRiskMetrics] = useState(null);
  const [accuracyData, setAccuracyData] = useState(null);

  const handleSearch = async () => {
    setLoading(true);
    try {
      // Tahmin verilerini çek
      const forecastRes = await client.get(`/backtest/${symbol}/full`);
      const backtestRes = await client.get(`/backtest/${symbol}/backtest`, {
        params: { period, holdingPeriod, stopLoss: stopLoss / 100, takeProfit: takeProfit / 100 }
      });
      const riskRes = await client.get(`/backtest/${symbol}/risk`);
      const accuracyRes = await client.get(`/backtest/${symbol}/accuracy`, {
        params: { lookbackDays: 365 }
      });

      setForecastData(forecastRes.data.data?.horizons ? Object.values(forecastRes.data.data.horizons) : []);
      setBacktestResult(backtestRes.data.data);
      setRiskMetrics(riskRes.data.data);
      setAccuracyData(accuracyRes.data.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      // Fallback to sample data
      setForecastData([]);
      setBacktestResult({});
      setRiskMetrics({});
      setAccuracyData({});
      setLoading(false);
    }
  };

  useEffect(() => {
    if (paramSymbol) {
      setSymbol(paramSymbol);
      handleSearch();
    }
  }, [paramSymbol]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-6">Backtesting & Tahmin Modülü</h1>

      {/* Arama ve Parametreler */}
      <Card className="p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Sembol</label>
            <input
              type="text"
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="Örn: GARAN"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Zaman Dilimi</label>
            <select
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="DAILY">Günlük</option>
              <option value="WEEKLY">Haftalık</option>
              <option value="MONTHLY">Aylık</option>
              <option value="YEARLY">Yıllık</option>
              <option value="ALL">Tümü</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Stop Loss (%)</label>
            <input
              type="number"
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white"
              value={stopLoss}
              onChange={(e) => setStopLoss(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Take Profit (%)</label>
            <input
              type="number"
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white"
              value={takeProfit}
              onChange={(e) => setTakeProfit(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSearch} loading={loading}>
            Analiz Çalıştır
          </Button>
        </div>
      </Card>

      {/* Horizon Tahmin Grid */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-4">Çoklu Horizon Tahminleri</h2>
        <HorizonForecastChart data={forecastData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backtest Equity Curve */}
        <Card className="p-6">
          <h2 className="text-xl font-bold text-white mb-4">Equity Curve</h2>
          <BacktestEquityCurve data={backtestResult?.equityCurve} />
        </Card>

        {/* Sinyal Doğruluk Chart */}
        <Card className="p-6">
          <h2 className="text-xl font-bold text-white mb-4">Sinyal Doğruluk Oranları</h2>
          <SignalAccuracyChart data={accuracyData} />
        </Card>
      </div>

      {/* Risk Metrikleri */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-white mb-4">Risk Metrikleri</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 text-center">
            <div className="text-sm text-slate-400">VaR %95</div>
            <div className="text-2xl font-bold text-white">
              {riskMetrics?.var95 ? `${riskMetrics.var95}%` : '--'}
            </div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-sm text-slate-400">CVaR %95</div>
            <div className="text-2xl font-bold text-white">
              {riskMetrics?.cvar95 ? `${riskMetrics.cvar95}%` : '--'}
            </div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-sm text-slate-400">Sortino Ratio</div>
            <div className="text-2xl font-bold text-white">
              {riskMetrics?.sortinoRatio || '--'}
            </div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-sm text-slate-400">Beta</div>
            <div className="text-2xl font-bold text-white">
              {riskMetrics?.beta || '--'}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
