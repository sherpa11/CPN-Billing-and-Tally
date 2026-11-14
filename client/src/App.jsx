import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';

// Components & Pages
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import NewBill from './pages/NewBill';
import AllBills from './pages/AllBills';
import Customers from './pages/Customers';
import Vegetables from './pages/Vegetables';
import Payments from './pages/Payments';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Login from './pages/Login';
import TestPrintPage from './pages/TestPrintPage';

import ErrorBoundary from './components/ErrorBoundary';

export function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <SettingsProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/test-print" element={<TestPrintPage />} />
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="new-bill" element={<NewBill />} />
                <Route path="bills" element={<AllBills />} />
                <Route path="customers" element={<Customers />} />
                <Route path="vegetables" element={<Vegetables />} />
                <Route path="payments" element={<Payments />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </SettingsProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
