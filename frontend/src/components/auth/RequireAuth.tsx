import { Navigate, Outlet, useLocation } from 'react-router';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/stores/auth';

export function RequireAuth() {
  const status = useAuth((s) => s.status);
  const location = useLocation();

  if (status === 'checking') return <FullScreenLoader />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

export function RequireAdmin() {
  const role = useAuth((s) => s.user?.role);
  if (role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function FullScreenLoader() {
  return (
    <div className="flex h-full items-center justify-center text-slate-400">
      <Loader2 className="animate-spin" />
    </div>
  );
}
