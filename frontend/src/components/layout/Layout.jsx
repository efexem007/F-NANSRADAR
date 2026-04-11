import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';

const Layout = () => {
  const { user } = useContext(AuthContext);

  return (
    <div className="flex min-h-screen bg-[#0a0e27]">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <header className="h-16 flex items-center justify-between px-8 border-b border-[rgba(255,255,255,0.05)] bg-[#0a0e27]/80 backdrop-blur-md sticky top-0 z-10">
          <div className="font-medium text-gray-300">
            {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#00d4ff] to-[#9b51e0] flex items-center justify-center font-bold text-[#0a0e27]">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="font-medium hidden sm:block">{user?.name || 'User'}</span>
            </div>
          </div>
        </header>
        <main className="flex-1 p-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
