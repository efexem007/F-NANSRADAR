import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useContext } from 'react'
import { AuthContext } from '../../context/AuthContext'

const Layout = () => {
  const { user } = useContext(AuthContext)

  return (
    <div className="flex min-h-screen bg-[#0d0d1a] text-slate-100">
      <Sidebar />
      <div className="flex-1 ml-[240px] flex flex-col">
        {/* Header with CANLI badge (Madde 8) */}
        <header className="h-14 flex items-center justify-between px-8 border-b border-white/5 bg-[#0a0a1f]/80 backdrop-blur-md sticky top-0 z-20">
          <div className="text-sm text-slate-500">
            {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <div className="flex items-center gap-4">
            {/* Madde 8: Canlı gösterge */}
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-green-400 text-xs font-medium">CANLI</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-sm font-bold text-white">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <span className="text-sm font-medium text-slate-400">{user?.name || 'Kullanıcı'}</span>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
