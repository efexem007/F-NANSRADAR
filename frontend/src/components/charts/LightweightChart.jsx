import { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';

/**
 * LightweightChart — TradingView-style professional candlestick chart
 * Uses lightweight-charts library for high-performance financial charts
 */

export default function LightweightChart({ data = [], height = 400 }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data.length) return;

    const chart = createChart(chartContainerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#8b5cf6', width: 1, style: 2 },
        horzLine: { color: '#8b5cf6', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
      },
    });
    chartRef.current = chart;

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#8b5cf6',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    const formatted = data.map(d => ({
      time: new Date(d.date).getTime() / 1000,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumeData = data.map(d => ({
      time: new Date(d.date).getTime() / 1000,
      value: d.volume || 0,
      color: d.close >= d.open ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)',
    }));

    candlestickSeries.setData(formatted);
    volumeSeries.setData(volumeData);

    // Add SMA lines if we have enough data
    if (formatted.length >= 20) {
      const sma20 = formatted.map((c, i, arr) => {
        if (i < 19) return null;
        const slice = arr.slice(i - 19, i + 1);
        const avg = slice.reduce((s, x) => s + x.close, 0) / 20;
        return { time: c.time, value: avg };
      }).filter(Boolean);

      const smaLine = chart.addLineSeries({
        color: '#f59e0b',
        lineWidth: 1,
        title: 'SMA 20',
      });
      smaLine.setData(sma20);
    }

    if (formatted.length >= 50) {
      const sma50 = formatted.map((c, i, arr) => {
        if (i < 49) return null;
        const slice = arr.slice(i - 49, i + 1);
        const avg = slice.reduce((s, x) => s + x.close, 0) / 50;
        return { time: c.time, value: avg };
      }).filter(Boolean);

      const sma50Line = chart.addLineSeries({
        color: '#06b6d4',
        lineWidth: 1,
        title: 'SMA 50',
      });
      sma50Line.setData(sma50);
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, height]);

  return (
    <div
      ref={chartContainerRef}
      style={{ width: '100%', height: `${height}px` }}
    />
  );
}
