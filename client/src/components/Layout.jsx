import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Receipt,
  LayoutDashboard,
  Users,
  Carrot,
  Wallet,
  BarChart3,
  Settings as SettingsIcon,
  Menu,
  X,
  LogOut,
  PlusCircle,
  Wifi,
  WifiOff,
  Printer,
  Truck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

export const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        const res = await fetch('/api/health');
        setIsOnline(res.ok);
      } catch (e) {
        setIsOnline(false);
      }
    };

    checkServerHealth();
    const interval = setInterval(checkServerHealth, 15000);

    const handleOnline = () => checkServerHealth();
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Global keyboard shortcuts (F2 or Alt+N for New Bill, Alt+B for All Bills)
  useEffect(() => {
    const handleGlobalKeys = (e) => {
      if (e.key === 'F2' || (e.altKey && (e.key === 'n' || e.key === 'N'))) {
        e.preventDefault();
        navigate('/new-bill');
      } else if (e.altKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        navigate('/bills');
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [navigate]);

  // Lock body scroll when mobile navigation drawer is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'New Bill (F2)', path: '/new-bill', icon: PlusCircle, highlight: true },
    { name: 'All Bills', path: '/bills', icon: Receipt },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Purchase / கொள்முதல்', path: '/purchases', icon: Truck },
    { name: 'Vegetables', path: '/vegetables', icon: Carrot },
    { name: 'Payments', path: '/payments', icon: Wallet },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile Header Bar */}
      <header className="md:hidden bg-[#034D28] text-white px-3 sm:px-4 py-2.5 flex items-center justify-between shadow-md sticky top-0 z-40 no-print">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={settings.logoUrl || '/cpn_logo.png'}
            alt="CPN"
            className="w-8 h-8 object-contain rounded-lg bg-white p-0.5 flex-shrink-0"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div className="min-w-0">
            <h1 className="font-black text-sm sm:text-base tracking-wide leading-tight truncate">
              {settings.shopName || 'CPN VEGETABLES'}
            </h1>
            <p className="text-[10px] text-emerald-200 font-tamil leading-none truncate">
              திண்டுக்கல்
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isOnline && (
            <span className="flex items-center gap-1 text-[10px] bg-red-600 px-2 py-0.5 rounded-full font-bold">
              <WifiOff className="w-3 h-3" /> Offline
            </span>
          )}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-emerald-800 text-white hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Sidebar for Desktop & Drawer for Mobile */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen max-h-screen w-72 max-w-[85vw] md:w-64 bg-[#034D28] text-white flex flex-col z-50 transition-transform duration-200 ease-in-out no-print shadow-2xl md:shadow-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-emerald-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-white p-1 flex-shrink-0 shadow-sm flex items-center justify-center">
              <img
                src={settings.logoUrl || '/cpn_logo.png'}
                alt="CPN Logo"
                className="w-full h-full object-contain"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-extrabold text-sm sm:text-base leading-tight tracking-wide truncate">
                {settings.shopName || 'CPN VEGETABLES'}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-emerald-200 font-tamil truncate">
                காந்தி மார்க்கெட், திண்டுக்கல்
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-white/80 hover:text-white p-2 rounded-lg hover:bg-emerald-800 min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick New Bill Action Banner */}
        <div className="p-3">
          <NavLink
            to="/new-bill"
            onClick={() => setSidebarOpen(false)}
            className="w-full flex items-center justify-center gap-2 py-3 px-3 bg-emerald-500 hover:bg-emerald-400 text-[#034D28] font-black rounded-xl shadow-md transition-all active:scale-98 text-sm uppercase tracking-wide min-h-[44px]"
          >
            <PlusCircle className="w-4 h-4 stroke-[2.5]" />
            <span>New Bill (F2)</span>
          </NavLink>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-sm transition-all min-h-[42px] ${
                  isActive
                    ? 'bg-white text-[#034D28] shadow-md'
                    : 'text-emerald-100 hover:bg-emerald-800/70 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#034D28]' : 'text-emerald-300'}`} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Network & Footer Status */}
        <div className="p-3 border-t border-emerald-800/80 bg-[#02381c]">
          <div className="flex items-center justify-between text-xs text-emerald-200 mb-2">
            <span className="flex items-center gap-1.5 font-semibold">
              {isOnline ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Online Connected</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-red-300 font-bold">Offline</span>
                </>
              )}
            </span>
            <span className="text-[10px] text-emerald-300 font-tamil">
              வாழ்க வளமுடன்
            </span>
          </div>

          {user && (
            <div className="flex items-center justify-between pt-1">
              <div className="truncate text-xs font-semibold text-white">
                {user.name || user.username}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs text-emerald-300 hover:text-white flex items-center gap-1.5 font-bold cursor-pointer min-h-[36px] px-2 py-1 rounded-lg hover:bg-emerald-900/50"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Exit</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-3 sm:p-5 md:p-6 overflow-x-hidden">
        <Outlet />
      </main>

      {/* Backdrop for mobile drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden no-print backdrop-blur-xs transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;
