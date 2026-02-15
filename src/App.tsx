import { Suspense, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';

import { AuthProvider } from '@/auth/AuthProvider';
import { RequireAuth } from '@/auth/RequireAuth';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

const Index = lazyWithRetry(() => import('./pages/Index'));
const Products = lazyWithRetry(() => import('./pages/Products'));
const ProductDetail = lazyWithRetry(() => import('./pages/ProductDetail'));
const NotFound = lazyWithRetry(() => import('./pages/NotFound'));
const Cart = lazyWithRetry(() => import('./pages/Cart'));
const Wishlist = lazyWithRetry(() => import('./pages/Wishlist'));
const Account = lazyWithRetry(() => import('./pages/Account'));
const Checkout = lazyWithRetry(() => import('./pages/Checkout'));
const OrderTracking = lazyWithRetry(() => import('./pages/OrderTracking'));
const OrderConfirmation = lazyWithRetry(() => import('./pages/OrderConfirmation'));
const Login = lazyWithRetry(() => import('./pages/Login'));
const SignUp = lazyWithRetry(() => import('./pages/SignUp'));
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'));
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'));
const About = lazyWithRetry(() => import('./pages/About'));
const Contact = lazyWithRetry(() => import('./pages/Contact'));
const Shipping = lazyWithRetry(() => import('./pages/Shipping'));
const Returns = lazyWithRetry(() => import('./pages/Returns'));
const FAQ = lazyWithRetry(() => import('./pages/FAQ'));

import { AdminAuthProvider } from '@/admin/AdminAuthProvider';
import RequireAdmin from '@/admin/RequireAdmin';
import AdminLayout from '@/admin/AdminLayout';
const AdminLogin = lazyWithRetry(() => import('@/admin/pages/AdminLogin'));
const AdminDashboard = lazyWithRetry(() => import('@/admin/pages/AdminDashboard'));
const AdminProducts = lazyWithRetry(() => import('@/admin/pages/AdminProducts'));
const AdminCategories = lazyWithRetry(() => import('@/admin/pages/AdminCategories'));
const AdminOrders = lazyWithRetry(() => import('@/admin/pages/AdminOrders'));
const AdminUsers = lazyWithRetry(() => import('@/admin/pages/AdminUsers'));
const AdminSettings = lazyWithRetry(() => import('@/admin/pages/AdminSettings'));
const AdminProfile = lazyWithRetry(() => import('@/admin/pages/AdminProfile'));
const AdminNotificationSettings = lazyWithRetry(() => import('@/admin/pages/AdminNotificationSettings'));
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
              <Suspense
                fallback={(
                  <div className="min-h-screen flex items-center justify-center">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading app…</span>
                    </div>
                  </div>
                )}
              >
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
