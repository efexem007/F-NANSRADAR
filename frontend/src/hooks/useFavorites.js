import { useState } from 'react'

export const useFavorites = () => {
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('favorites') || '[]') } catch { return [] }
  })
  const toggle = (ticker) => {
    setFavorites(prev => {
      const next = prev.includes(ticker) ? prev.filter(t => t !== ticker) : [...prev, ticker]
      localStorage.setItem('favorites', JSON.stringify(next))
      return next
    })
  }
  const isFavorite = (ticker) => favorites.includes(ticker)
  return { favorites, toggle, isFavorite }
}
