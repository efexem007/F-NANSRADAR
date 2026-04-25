import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/layout/Layout'
import ScrollCanvas from './components/ScrollCanvas'

import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Portfolio from './pages/Portfolio'
import Signals from './pages/Signals'
import Backtest from './pages/Backtest'
import Macro from './pages/Macro'
import Settings from './pages/Settings'
import StockDetail from './pages/StockDetail'
import Scanner from './pages/Scanner'
import AllStocks from './pages/AllStocks'

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div key={location.pathname}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
        <Routes location={location}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/signals" element={<Signals />} />
              <Route path="/backtest" element={<Backtest />} />
              <Route path="/macro" element={<Macro />} />
              <Route path="/scanner" element={<Scanner />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/stock/:ticker" element={<StockDetail />} />
              <Route path="/stocks" element={<AllStocks />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ScrollCanvas />
        <AnimatedRoutes />
        <Toaster position="top-right" toastOptions={{
          style: { background: '#1a1a35', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)' }
        }} />
      </AuthProvider>
    </Router>
  )
}

export default App
