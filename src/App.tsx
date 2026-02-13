import { Suspense, lazy, useEffect } from 'react';

import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';

import { AuthProvider } from '@/auth/AuthProvider';
import { RequireAuth } from '@/auth/RequireAuth';

const Index = lazy(() => import('./pages/Index'));
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Cart = lazy(() => import('./pages/Cart'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const Account = lazy(() => import('./pages/Account'));
const Checkout = lazy(() => import('./pages/Checkout'));
const OrderTracking = lazy(() => import('./pages/OrderTracking'));
const OrderConfirmation = lazy(() => import('./pages/OrderConfirmation'));
const Login = lazy(() => import('./pages/Login'));
const SignUp = lazy(() => import('./pages/SignUp'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Shipping = lazy(() => import('./pages/Shipping'));
const Returns = lazy(() => import('./pages/Returns'));
const FAQ = lazy(() => import('./pages/FAQ'));

import { AdminAuthProvider } from '@/admin/AdminAuthProvider';
import RequireAdmin from '@/admin/RequireAdmin';
import AdminLayout from '@/admin/AdminLayout';
const AdminLogin = lazy(() => import('@/admin/pages/AdminLogin'));
const AdminDashboard = lazy(() => import('@/admin/pages/AdminDashboard'));
const AdminProducts = lazy(() => import('@/admin/pages/AdminProducts'));
const AdminCategories = lazy(() => import('@/admin/pages/AdminCategories'));
const AdminOrders = lazy(() => import('@/admin/pages/AdminOrders'));
const AdminUsers = lazy(() => import('@/admin/pages/AdminUsers'));
const AdminSettings = lazy(() => import('@/admin/pages/AdminSettings'));
const AdminProfile = lazy(() => import('@/admin/pages/AdminProfile'));
const AdminNotificationSettings = lazy(() => import('@/admin/pages/AdminNotificationSettings'));
import AppErrorBoundary from '@/components/AppErrorBoundary';

const queryClient = new QueryClient();

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

const ScrollToHash = () => {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;

    const id = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
    if (!id) return;

    let raf: number | null = null;
    let attempts = 0;

    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      attempts += 1;
      if (attempts >= 10) return;
      raf = window.requestAnimationFrame(tryScroll);
    };

    tryScroll();

    return () => {
      if (raf != null) window.cancelAnimationFrame(raf);
    };
  }, [location.pathname, location.hash]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <AdminAuthProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <ScrollToTop />
            <ScrollToHash />
            <AppErrorBoundary>
              <Suspense fallback={<div className="min-h-screen" />}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Index />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/product/:id" element={<ProductDetail />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/wishlist" element={<Wishlist />} />
                  <Route path="/track-order" element={<OrderTracking />} />
                  <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/shipping" element={<Shipping />} />
                  <Route path="/returns" element={<Returns />} />
                  <Route path="/faq" element={<FAQ />} />

                  {/* Auth routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<SignUp />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />

                  {/* Protected customer routes */}
                  <Route
                    path="/account"
                    element={(
                      <RequireAuth requireVerified>
                        <Account />
                      </RequireAuth>
                    )}
                  />
                  <Route
                    path="/checkout"
                    element={<Checkout />}
                  />

                  {/* Admin routes */}
                  <Route path="/admin/login" element={<AdminLogin />} />
                  <Route path="/admin" element={<RequireAdmin />}>
                    <Route element={<AdminLayout />}>
                      <Route index element={<AdminDashboard />} />
                      <Route path="analytics" element={<AdminDashboard />} />
                      <Route path="products" element={<AdminProducts />} />
                      <Route path="categories" element={<AdminCategories />} />
                      <Route path="orders" element={<AdminOrders />} />
                      <Route path="users" element={<AdminUsers />} />
                      <Route path="profile" element={<AdminProfile />} />
                      <Route path="settings" element={<AdminSettings />} />
                      <Route path="notifications" element={<AdminNotificationSettings />} />
                    </Route>
                  </Route>

                  {/* Catch-all */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AppErrorBoundary>
          </BrowserRouter>
        </AdminAuthProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
