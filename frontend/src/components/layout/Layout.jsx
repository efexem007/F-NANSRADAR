import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';

const Layout = () => {
  const { user } = useContext(AuthContext);

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <Sidebar />
      <div className="flex-1 ml-[240px] flex flex-col">
        {/* Top Header Bar */}
        <header className="h-14 flex items-center justify-between px-8 border-b border-border bg-bg-header/80 backdrop-blur-md sticky top-0 z-20">
          <div className="text-sm text-text-muted font-medium">
            {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-purple flex items-center justify-center text-sm font-bold text-bg-primary">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="text-sm font-medium text-text-secondary">{user?.name || 'Kullanıcı'}</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
