import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { api, setAuthToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  // Restore session on load.
  useEffect(() => {
    const token = localStorage.getItem('md_token');
    if (!token) { setBooting(false); return; }
    setAuthToken(token);
    api.get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => {
        localStorage.removeItem('md_token');
        setAuthToken(null);
      })
      .finally(() => setBooting(false));
  }, []);

  const login = useCallback(async (email, password, role) => {
    const res = await api.post('/auth/login', { email, password, role });
    localStorage.setItem('md_token', res.data.token);
    setAuthToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  /**
   * Patient registration no longer opens a session: the API returns an
   * email-OTP challenge that must be completed with verifyOtp().
   */
  const register = useCallback(async (payload) => {
    const res = await api.post('/auth/register', payload);
    return res.data;
  }, []);

  const verifyOtp = useCallback(async (email, otp) => {
    const res = await api.post('/auth/verify-otp', { email, otp });
    localStorage.setItem('md_token', res.data.token);
    setAuthToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const resendOtp = useCallback(async (email) => {
    const res = await api.post('/auth/resend-otp', { email });
    return res.data;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* token already invalid */ }
    localStorage.removeItem('md_token');
    setAuthToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, booting, login, register, verifyOtp, resendOtp, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
