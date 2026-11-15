import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
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

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ? children : <Outlet />;
};

export default ProtectedRoute;
