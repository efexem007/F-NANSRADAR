import { NavLink } from 'react-router-dom'
import { BarChart2, PieChart, Activity, Settings, LogOut, TrendingUp, Cpu, Globe } from 'lucide-react'
import { useContext } from 'react'
import { AuthContext } from '../../context/AuthContext'

const links = [
  { to: '/',          icon: Activity,   label: 'Dashboard' },
  { to: '/portfolio', icon: PieChart,   label: 'Portföy' },
  { to: '/signals',   icon: TrendingUp, label: 'Sinyaller' },
  { to: '/scanner',   icon: Cpu,        label: 'AI Scanner' },
  { to: '/backtest',  icon: Cpu,        label: 'Backtest' },
  { to: '/macro',     icon: Globe,      label: 'Makro' },
  { to: '/settings',  icon: Settings,   label: 'Ayarlar' },
]

const Sidebar = () => {
  const { logout } = useContext(AuthContext)

  return (
    <aside className="w-[240px] h-screen bg-[#0a0a1f] border-r border-white/5 fixed left-0 top-0 flex flex-col z-30">
      {/* Madde 3: Gradient Logo */}
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-white/5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-base font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">FinansRadar</div>
          <div className="text-[10px] text-slate-500 -mt-0.5">BORSA ANALİZ</div>
        </div>
      </div>

      <nav className="flex-1 py-5 px-3 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 mb-3">Genel</p>
        {links.map(link => (
          <NavLink key={link.to} to={link.to} end={link.to === '/'}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <link.icon size={18} />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-white/5">
        <button onClick={logout} className="sidebar-link w-full hover:!text-red-400 hover:!bg-red-500/10">
          <LogOut size={18} /> Çıkış Yap
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
