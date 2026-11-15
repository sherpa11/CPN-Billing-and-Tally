import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cpn_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for centralized error extraction and 401 handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      // Avoid firing auth:expired on login requests or startup /auth/me verification
      if (!url.includes('/auth/login') && !url.includes('/auth/me')) {
        localStorage.removeItem('cpn_token');
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
    }
    const message =
      error.response?.data?.message ||
      error.message ||
      'An unexpected network or server error occurred.';
    return Promise.reject(new Error(message));
  }
);

export default api;
