import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'finansradar_favorites';

const loadFavorites = (): string[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const useFavorites = () => {
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = useCallback((code: string) => {
    setFavorites(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  }, []);

  const isFavorite = useCallback(
    (code: string) => favorites.includes(code),
    [favorites]
  );

  return { favorites, toggleFavorite, isFavorite };
};
