import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('cpn_token');
      if (token) {
        try {
          const res = await api.get('/auth/me');
          if (res.success) {
            setUser(res.user);
          }
        } catch (err) {
          console.warn('[Auth] Token invalid or expired, removing token.');
          localStorage.removeItem('cpn_token');
          setUser(null);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    if (res.success) {
      localStorage.setItem('cpn_token', res.token);
      setUser(res.user);
      return res.user;
    }
    throw new Error(res.message || 'Login failed');
  };

  const setupAdmin = async (username, password, name) => {
    const res = await api.post('/auth/setup', { username, password, name });
    if (res.success) {
      localStorage.setItem('cpn_token', res.token);
      setUser(res.user);
      return res.user;
    }
    throw new Error(res.message || 'Admin setup failed');
  };

  const logout = () => {
    localStorage.removeItem('cpn_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, setupAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
