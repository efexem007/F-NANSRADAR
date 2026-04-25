import { useState, useMemo, useCallback } from 'react';
import type { StockData } from '@/types';
import { generateAllStocks, generateSignals, generateMarketIndices } from '@/utils/mockData';
import { useFavorites } from './useFavorites';

const allStocks = generateAllStocks();
const signals = generateSignals(allStocks);
const marketIndices = generateMarketIndices();

export const useStocks = () => {
  const [stocks] = useState<StockData[]>(allStocks);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('Tümü');
  const [selectedIndex, setSelectedIndex] = useState<string>('Tümü');
  const [selectedSignal, setSelectedSignal] = useState<string>('Tümü');
  const [sortBy, setSortBy] = useState<string>('change');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  const filteredStocks = useMemo(() => {
    let result = [...stocks];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        s => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
      );
    }

    if (selectedSector !== 'Tümü') {
      result = result.filter(s => s.sector === selectedSector);
    }

    if (selectedIndex !== 'Tümü') {
      result = result.filter(s => s.index === selectedIndex);
    }

    if (selectedSignal !== 'Tümü') {
      result = result.filter(s => s.signal === selectedSignal);
    }

    result.sort((a, b) => {
      const aVal = a[sortBy as keyof StockData] as number;
      const bVal = b[sortBy as keyof StockData] as number;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return result;
  }, [stocks, searchQuery, selectedSector, selectedIndex, selectedSignal, sortBy, sortOrder]);

  const paginatedStocks = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredStocks.slice(start, start + itemsPerPage);
  }, [filteredStocks, currentPage]);

  const totalPages = Math.ceil(filteredStocks.length / itemsPerPage);

  const getStockByCode = useCallback(
    (code: string) => {
      const stock = stocks.find(s => s.code === code.toUpperCase());
      if (stock) {
        return { ...stock, isFavorite: isFavorite(stock.code) };
      }
      return undefined;
    },
    [stocks, isFavorite]
  );

  const getTopMovers = useCallback(
    (limit = 10) => {
      return [...stocks].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, limit);
    },
    [stocks]
  );

  const getTopGainers = useCallback(
    (limit = 10) => {
      return [...stocks].filter(s => s.change > 0).sort((a, b) => b.change - a.change).slice(0, limit);
    },
    [stocks]
  );

  const getTopLosers = useCallback(
    (limit = 10) => {
      return [...stocks].filter(s => s.change < 0).sort((a, b) => a.change - b.change).slice(0, limit);
    },
    [stocks]
  );

  const getStrongestSignals = useCallback(
    (limit = 10) => {
      return [...stocks].sort((a, b) => b.signalScore - a.signalScore).slice(0, limit);
    },
    [stocks]
  );

  return {
    stocks,
    filteredStocks,
    paginatedStocks,
    signals,
    marketIndices,
    searchQuery,
    setSearchQuery,
    selectedSector,
    setSelectedSector,
    selectedIndex,
    setSelectedIndex,
    selectedSignal,
    setSelectedSignal,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    currentPage,
    setCurrentPage,
    totalPages,
    favorites,
    toggleFavorite,
    isFavorite,
    getStockByCode,
    getTopMovers,
    getTopGainers,
    getTopLosers,
    getStrongestSignals,
    itemsPerPage,
  };
};
