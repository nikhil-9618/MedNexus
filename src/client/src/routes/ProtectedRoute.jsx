import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Loader } from '../components/common/Loader.jsx';
import { PATHS } from './paths.js';

/** Blocks unauthenticated users. */
export function RequireAuth() {
  const { user, booting } = useAuth();
  const location = useLocation();
  if (booting) return <Loader fullScreen label="Checking your session…" />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <Outlet />;
}

/** Blocks users without one of the allowed roles. */
export function RequireRole({ roles }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    // Role mismatch is a security event — show the Access Denied screen.
    return <Navigate to={PATHS.accessDenied} state={{ from: location.pathname }} replace />;
  }
  return <Outlet />;
}
