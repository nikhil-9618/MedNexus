import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthChange, AUTH_EVENTS } from '@netlify/identity';
import { useToast } from './ToastContext.jsx';
import {
  initializeIdentity, loadAccount, createIdentityAccount, signIn, signOut,
} from '../services/identityService.js';
import { apiError } from '../services/api.js';
import { homeForRole } from '../routes/paths.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthChange((event) => {
      if (active && event === AUTH_EVENTS.LOGOUT) setUser(null);
    });
    initializeIdentity()
      .then(async ({ identity, callback }) => {
        if (!identity) return;
        const account = await loadAccount();
        if (!active) return;
        setUser(account);
        if (callback?.type === 'confirmation') {
          toast.success('Email confirmed. Your account is ready.');
          navigate(homeForRole(account.role), { replace: true });
        }
      })
      .catch((error) => {
        if (!active) return;
        const message = apiError(error);
        setSessionError(message);
        toast.error(message);
      })
      .finally(() => { if (active) setBooting(false); });
    return () => { active = false; unsubscribe(); };
  }, []);

  const login = useCallback(async (email, password, role) => {
    const account = await signIn(email, password, role);
    setSessionError('');
    setUser(account);
    return account;
  }, []);

  const register = useCallback(async (payload) => {
    const result = await createIdentityAccount(payload);
    if (result.user) setUser(result.user);
    return result;
  }, []);

  const logout = useCallback(async () => {
    try { await signOut(); }
    finally { setUser(null); setSessionError(''); }
  }, []);

  return (
    <AuthContext.Provider value={{ user, booting, sessionError, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
