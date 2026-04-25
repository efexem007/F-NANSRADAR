import { useMemo } from 'react';
import type { StockData, AlgorithmStep } from '@/types';
import { ALGORITHM_STEPS } from '@/constants/algorithm';

export const useAlgorithm = (stock: StockData) => {
  const steps: AlgorithmStep[] = useMemo(() => {
    const s = stock;
    return [
      {
        ...ALGORITHM_STEPS[0],
        score: Math.min(100, Math.max(0, 50 + (s.change * 10))),
      },
      {
        ...ALGORITHM_STEPS[1],
        score: s.rsi ? Math.min(100, Math.max(0, 100 - Math.abs(s.rsi - 50) * 2)) : 50,
      },
      {
        ...ALGORITHM_STEPS[2],
        score: s.macd ? Math.min(100, Math.max(0, 50 + s.macd * 15)) : 50,
      },
      {
        ...ALGORITHM_STEPS[3],
        score: s.bollingerUpper && s.bollingerLower
          ? Math.min(100, Math.max(0, 100 - (Math.abs(s.price - (s.bollingerUpper + s.bollingerLower) / 2) / ((s.bollingerUpper - s.bollingerLower) / 2)) * 100))
          : 50,
      },
      {
        ...ALGORITHM_STEPS[4],
        score: Math.min(100, Math.max(0, (s.volume / 10_000_000) * 10)),
      },
      {
        ...ALGORITHM_STEPS[5],
        score: s.support && s.resistance
          ? Math.min(100, Math.max(0, 100 - (Math.abs(s.price - (s.support + s.resistance) / 2) / ((s.resistance - s.support) / 2)) * 50))
          : 50,
      },
      {
        ...ALGORITHM_STEPS[6],
        score: s.ema9 && s.ema21
          ? Math.min(100, Math.max(0, 50 + (s.ema9 > s.ema21 ? 20 : -20) + (s.ema21 > (s.ema50 || 0) ? 10 : -10)))
          : 50,
      },
      {
        ...ALGORITHM_STEPS[7],
        score: Math.min(100, Math.max(0, 50 + (s.change - (s.sector === 'Bankacılık' ? 0.5 : 0)) * 8)),
      },
      {
        ...ALGORITHM_STEPS[8],
        score: Math.min(100, Math.max(0, 100 - Math.abs(s.change) * 5)),
      },
      {
        ...ALGORITHM_STEPS[9],
        score: s.signalScore,
      },
    ];
  }, [stock]);

  const finalScore = useMemo(() => {
    return steps.reduce((sum, step) => sum + step.score * step.weight, 0);
  }, [steps]);

  return { steps, finalScore };
};
