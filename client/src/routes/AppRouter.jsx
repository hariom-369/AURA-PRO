import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import ProtectedRoute from './ProtectedRoute';
import AdminRoute from './AdminRoute';
import SellerRoute from './SellerRoute';

import Home from '../pages/Home';
import ProductDetail from '../pages/ProductDetail';
import Cart from '../pages/Cart';
import Checkout from '../pages/Checkout';
import Login from '../pages/Login';
import Register from '../pages/Register';
import ForgotPassword from '../pages/ForgotPassword';
import Orders from '../pages/Orders';
import OrderDetail from '../pages/OrderDetail';
import Wishlist from '../pages/Wishlist';
import Addresses from '../pages/Addresses';
import Compare from '../pages/Compare';
import Profile from '../pages/Profile';
import BecomeASeller from '../pages/sell/BecomeASeller';
import SellerOnboarding from '../pages/sell/SellerOnboarding';
import SellerApplicationStatus from '../pages/sell/SellerApplicationStatus';
import NotFound from '../pages/NotFound';

// Lazy-loaded: both pull in recharts, which regular customers never need to download.
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const SellerDashboard = lazy(() => import('../pages/seller/SellerDashboard'));

const dashboardFallback = (
  <div className="px-4 py-20 text-center text-zinc-400">Loading...</div>
);

export default function AppRouter() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/products/:slug" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/sell" element={<BecomeASeller />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/account/addresses" element={<Addresses />} />
          <Route path="/account/profile" element={<Profile />} />
          <Route path="/sell/onboarding" element={<SellerOnboarding />} />
          <Route path="/sell/status" element={<SellerApplicationStatus />} />
        </Route>

        <Route element={<AdminRoute />}>
          <Route
            path="/admin/*"
            element={
              <Suspense fallback={dashboardFallback}>
                <AdminDashboard />
              </Suspense>
            }
          />
        </Route>

        <Route element={<SellerRoute />}>
          <Route
            path="/seller/*"
            element={
              <Suspense fallback={dashboardFallback}>
                <SellerDashboard />
              </Suspense>
            }
          />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
