import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, User, ArrowRight, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { user, loading, login } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

  // Target route after login (default to /)
  const destination = location.state?.from?.pathname || '/';

  // If user is already authenticated, immediately navigate to destination
  useEffect(() => {
    if (!loading && user) {
      navigate(destination, { replace: true });
    }
  }, [user, loading, navigate, destination]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter username and password');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await login(username.trim(), password);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-8 flex flex-col items-center max-w-sm w-full space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-white p-1.5 shadow-md border border-gray-100 flex items-center justify-center">
            <img
              src="/cpn_logo.png"
              alt="CPN Logo"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
          <div className="text-center space-y-1">
            <h2 className="text-lg font-black tracking-wide text-gray-900 uppercase">
              CPN VEGETABLES
            </h2>
            <p className="text-xs text-[#034D28] font-bold">
              Wholesale Billing & Accounts
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 pt-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#034D28]" />
            <span>Verifying session...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-200 max-w-md w-full overflow-hidden">
        {/* Top Header */}
        <div className="bg-[#034D28] text-white p-6 text-center space-y-2">
          <div className="w-16 h-16 bg-white rounded-2xl mx-auto p-1.5 shadow-md flex items-center justify-center">
            <img
              src={settings.logoUrl || '/cpn_logo.png'}
              alt="CPN Logo"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
          <h2 className="text-xl font-black tracking-wide uppercase font-serif">
            {settings.shopName || 'CPN VEGETABLES'}
          </h2>
          <p className="text-xs text-emerald-200 font-tamil">
            {settings.tamilHeaderDeity || 'ஸ்ரீ பாப்பாபட்டி ஆச்சி ஒச்சாண்டம்மன் துணை'}
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-center pb-1">
            <h3 className="text-base font-bold text-gray-900">Admin Sign In</h3>
            <p className="text-xs text-gray-500">
              Enter your credentials to access wholesale billing & accounts
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Username
            </label>
            <div className="relative">
              <input
                type="text"
                required
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full pl-9 pr-3.5 py-2.5 border border-gray-300 rounded-xl focus:border-[#034D28] focus:ring-1 focus:ring-[#034D28] outline-none text-sm font-semibold"
              />
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-9 pr-10 py-2.5 border border-gray-300 rounded-xl focus:border-[#034D28] focus:ring-1 focus:ring-[#034D28] outline-none text-sm font-semibold"
              />
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-[#034D28] hover:bg-[#02361c] text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-98"
          >
            <span>{submitting ? 'Signing in...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
