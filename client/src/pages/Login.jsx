import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

export const Login = () => {
  const [username, setUsername] = useState('raja');
  const [password, setPassword] = useState('raja');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter username and password');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await login(username.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

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
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="raja"
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
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="raja"
                className="w-full pl-9 pr-3.5 py-2.5 border border-gray-300 rounded-xl focus:border-[#034D28] focus:ring-1 focus:ring-[#034D28] outline-none text-sm font-semibold"
              />
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
          </div>

          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-[#034D28] font-bold">
            <ShieldCheck className="w-4 h-4 flex-shrink-0 text-[#034D28]" />
            <span>Login credentials: Username <strong>raja</strong> / Password <strong>raja</strong></span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#034D28] hover:bg-[#02361c] text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-98"
          >
            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
