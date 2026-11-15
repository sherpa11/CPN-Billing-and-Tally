import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      const token = localStorage.getItem('cpn_token');
      if (token) {
        try {
          const res = await api.get('/auth/me');
          if (isMounted && res.success && res.user) {
            setUser(res.user);
          } else if (isMounted) {
            localStorage.removeItem('cpn_token');
            setUser(null);
          }
        } catch (err) {
          console.warn('[Auth] Token invalid or expired, removing token.');
          localStorage.removeItem('cpn_token');
          if (isMounted) setUser(null);
        }
      } else {
        if (isMounted) setUser(null);
      }
      if (isMounted) setLoading(false);
    };

    checkAuth();

    const handleExpired = () => {
      if (isMounted) {
        localStorage.removeItem('cpn_token');
        setUser(null);
      }
    };
    window.addEventListener('auth:expired', handleExpired);

    return () => {
      isMounted = false;
      window.removeEventListener('auth:expired', handleExpired);
    };
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    if (res.success && res.token) {
      localStorage.setItem('cpn_token', res.token);
      setUser(res.user);
      return res.user;
    }
    throw new Error(res.message || 'Login failed');
  };

  const setupAdmin = async (username, password, name) => {
    const res = await api.post('/auth/setup', { username, password, name });
    if (res.success && res.token) {
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
