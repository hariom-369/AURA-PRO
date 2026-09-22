import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSeller } from '../context/SellerContext';

export default function SellerRoute() {
  const { user, loading: authLoading } = useAuth();
  const { status, loading: sellerLoading } = useSeller();

  if (authLoading || sellerLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (status !== 'approved') return <Navigate to="/sell/status" replace />;
  return <Outlet />;
}
