import { NavLink } from 'react-router-dom';
import { 
  BarChart2, PieChart, Activity, Settings, LogOut, TrendingUp, Cpu, Globe
} from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';

const links = [
  { to: '/',          icon: Activity,   label: 'Dashboard' },
  { to: '/portfolio', icon: PieChart,   label: 'Portföy' },
  { to: '/signals',   icon: TrendingUp, label: 'Sinyaller' },
  { to: '/backtest',  icon: Cpu,        label: 'Backtest' },
  { to: '/macro',     icon: Globe,      label: 'Makro' },
  { to: '/settings',  icon: Settings,   label: 'Ayarlar' },
];

const Sidebar = () => {
  const { logout } = useContext(AuthContext);

  return (
    <aside className="w-[240px] h-screen bg-bg-sidebar border-r border-border fixed left-0 top-0 flex flex-col z-30">
      {/* Logo */}
      <div className="h-16 flex items-center gap-2.5 px-6 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple flex items-center justify-center">
          <Activity size={18} className="text-bg-primary" />
        </div>
        <span className="text-lg font-bold text-gradient tracking-tight">FinansRadar</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-5 px-3 space-y-1 overflow-y-auto">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted px-3 mb-3">Genel</p>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            <link.icon size={18} />
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-border">
        <button onClick={logout} className="sidebar-link w-full hover:!text-red hover:!bg-red/10">
          <LogOut size={18} />
          Çıkış Yap
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
