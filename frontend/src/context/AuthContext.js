// AuthContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyToken = useCallback(token => {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('ca5_token');
    if (token) {
      applyToken(token);
      axios.get('/api/auth/me')
        .then(r => setUser(r.data))
        .catch(() => localStorage.removeItem('ca5_token'))
        .finally(() => setLoading(false));
    } else { setLoading(false); }
  }, [applyToken]);

  const login = async (email, password) => {
    const res = await axios.post('/api/auth/login', { email, password });
    localStorage.setItem('ca5_token', res.data.token);
    applyToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async (name, email, password) => {
    await axios.post('/api/auth/register', { name, email, password });
  };

  const logout = () => {
    localStorage.removeItem('ca5_token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const refreshUser = async () => {
    try { const r = await axios.get('/api/auth/me'); setUser(r.data); return r.data; } catch { return null; }
  };

  return <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
