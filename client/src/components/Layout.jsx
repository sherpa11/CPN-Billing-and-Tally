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

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'New Bill (F2)', path: '/new-bill', icon: PlusCircle, highlight: true },
    { name: 'All Bills', path: '/bills', icon: Receipt },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Vegetables', path: '/vegetables', icon: Carrot },
    { name: 'Payments', path: '/payments', icon: Wallet },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile Header Bar */}
      <header className="md:hidden bg-[#034D28] text-white px-4 py-3 flex items-center justify-between shadow-md sticky top-0 z-40 no-print">
        <div className="flex items-center gap-2.5">
          <img
            src={settings.logoUrl || '/cpn_logo.png'}
            alt="CPN"
            className="w-8 h-8 object-contain rounded bg-white p-0.5"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div>
            <h1 className="font-extrabold text-base tracking-wide leading-tight">
              {settings.shopName || 'CPN VEGETABLES'}
            </h1>
            <p className="text-[10px] text-emerald-200 font-tamil leading-none">
              திண்டுக்கல்
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isOnline && (
            <span className="flex items-center gap-1 text-[11px] bg-red-600 px-2 py-0.5 rounded-full font-bold">
              <WifiOff className="w-3 h-3" /> Offline
            </span>
          )}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg bg-emerald-800 text-white hover:bg-emerald-700"
            aria-label="Toggle Navigation Menu"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Sidebar for Desktop & Drawer for Mobile */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-[#034D28] text-white flex flex-col z-50 transition-transform duration-200 ease-in-out no-print ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-emerald-800/80 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white p-1 flex-shrink-0 shadow-sm flex items-center justify-center">
            <img
              src={settings.logoUrl || '/cpn_logo.png'}
              alt="CPN Logo"
              className="w-full h-full object-contain"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-extrabold text-base leading-tight tracking-wide truncate">
              {settings.shopName || 'CPN VEGETABLES'}
            </h2>
            <p className="text-[11px] text-emerald-200 font-tamil truncate">
              காந்தி மார்க்கெட், திண்டுக்கல்
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-white/80 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick New Bill Action Banner */}
        <div className="p-3">
          <NavLink
            to="/new-bill"
            onClick={() => setSidebarOpen(false)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-[#034D28] font-black rounded-xl shadow-md transition-all active:scale-98 text-sm uppercase tracking-wide"
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
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-sm transition-all ${
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

          {user ? (
            <div className="flex items-center justify-between pt-1">
              <div className="truncate text-xs font-semibold text-white">
                {user.name || user.username}
              </div>
              <button
                type="button"
                onClick={logout}
                className="text-xs text-emerald-300 hover:text-white flex items-center gap-1 font-bold"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Exit</span>
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              className="text-xs text-emerald-300 hover:text-white flex items-center gap-1 font-bold"
            >
              Admin Sign In
            </NavLink>
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
          className="fixed inset-0 bg-black/50 z-40 md:hidden no-print"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;
