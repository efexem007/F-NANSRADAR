import { NavLink } from 'react-router-dom';
import { 
  BarChart2, 
  PieChart, 
  Activity, 
  Settings, 
  LogOut,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import clsx from 'clsx';

const Sidebar = () => {
  const { logout } = useContext(AuthContext);

  const links = [
    { to: '/', icon: Activity, label: 'Dashboard' },
    { to: '/portfolio', icon: PieChart, label: 'Portföy' },
    { to: '/signals', icon: TrendingUp, label: 'Sinyaller' },
    { to: '/backtest', icon: Cpu, label: 'Backtest' },
    { to: '/macro', icon: BarChart2, label: 'Makro' },
    { to: '/settings', icon: Settings, label: 'Ayarlar' },
  ];

  return (
    <div className="w-64 h-screen bg-[#0d122b] border-r border-[rgba(255,255,255,0.05)] flex flex-col fixed left-0 top-0">
      <div className="h-16 flex items-center px-6 border-b border-[rgba(255,255,255,0.05)]">
        <h1 className="text-xl font-bold text-gradient flex items-center gap-2">
          <Activity size={24} className="text-[#00d4ff]" />
          FinansRadar
        </h1>
      </div>

      <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200",
                isActive 
                  ? "bg-[#1a2141] text-[#00d4ff] shadow-[inset_4px_0_0_#00d4ff]" 
                  : "text-gray-400 hover:bg-[#1a2141] hover:text-gray-200"
              )
            }
          >
            <link.icon size={20} />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-[rgba(255,255,255,0.05)]">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-lg font-medium text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
        >
          <LogOut size={20} />
          Çıkış Yap
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
