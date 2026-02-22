import { Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

import { RequireAuth } from "@/auth/RequireAuth";
import RequireAdmin from "@/admin/RequireAdmin";
import AdminLayout from "@/admin/AdminLayout";
import PageTransition from "@/components/PageTransition";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

const Index = lazyWithRetry(() => import("@/pages/Index"));
const Products = lazyWithRetry(() => import("@/pages/Products"));
const ProductDetail = lazyWithRetry(() => import("@/pages/ProductDetail"));
const NotFound = lazyWithRetry(() => import("@/pages/NotFound"));
const Cart = lazyWithRetry(() => import("@/pages/Cart"));
const Wishlist = lazyWithRetry(() => import("@/pages/Wishlist"));
const Account = lazyWithRetry(() => import("@/pages/Account"));
const Checkout = lazyWithRetry(() => import("@/pages/Checkout"));
const OrderTracking = lazyWithRetry(() => import("@/pages/OrderTracking"));
const OrderConfirmation = lazyWithRetry(() => import("@/pages/OrderConfirmation"));
const Login = lazyWithRetry(() => import("@/pages/Login"));
const SignUp = lazyWithRetry(() => import("@/pages/SignUp"));
const ForgotPassword = lazyWithRetry(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazyWithRetry(() => import("@/pages/ResetPassword"));
const About = lazyWithRetry(() => import("@/pages/About"));
const Contact = lazyWithRetry(() => import("@/pages/Contact"));
const Shipping = lazyWithRetry(() => import("@/pages/Shipping"));
const Returns = lazyWithRetry(() => import("@/pages/Returns"));
const FAQ = lazyWithRetry(() => import("@/pages/FAQ"));

const AdminLogin = lazyWithRetry(() => import("@/admin/pages/AdminLogin"));
const AdminDashboard = lazyWithRetry(() => import("@/admin/pages/AdminDashboard"));
const AdminProducts = lazyWithRetry(() => import("@/admin/pages/AdminProducts"));
const AdminCategories = lazyWithRetry(() => import("@/admin/pages/AdminCategories"));
const AdminOrders = lazyWithRetry(() => import("@/admin/pages/AdminOrders"));
const AdminUsers = lazyWithRetry(() => import("@/admin/pages/AdminUsers"));
const AdminSettings = lazyWithRetry(() => import("@/admin/pages/AdminSettings"));
const AdminProfile = lazyWithRetry(() => import("@/admin/pages/AdminProfile"));
const AdminNotificationSettings = lazyWithRetry(() => import("@/admin/pages/AdminNotificationSettings"));
const AdminAboutPage = lazyWithRetry(() => import("@/admin/pages/AdminAboutPage"));

const SuspenseFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="flex items-center gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>Loading app…</span>
    </div>
  </div>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <PageTransition>{children}</PageTransition>
);

export default function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<SuspenseFallback />} key={location.pathname}>
        <Routes location={location}>
          {/* Public routes */}
          <Route path="/" element={<P><Index /></P>} />
          <Route path="/products" element={<P><Products /></P>} />
          <Route path="/product/:id" element={<P><ProductDetail /></P>} />
          <Route path="/cart" element={<P><Cart /></P>} />
          <Route path="/wishlist" element={<P><Wishlist /></P>} />
          <Route path="/track-order" element={<P><OrderTracking /></P>} />
          <Route path="/order-confirmation/:orderId" element={<P><OrderConfirmation /></P>} />
          <Route path="/about" element={<P><About /></P>} />
          <Route path="/contact" element={<P><Contact /></P>} />
          <Route path="/shipping" element={<P><Shipping /></P>} />
          <Route path="/returns" element={<P><Returns /></P>} />
          <Route path="/faq" element={<P><FAQ /></P>} />

          {/* Auth routes */}
          <Route path="/login" element={<P><Login /></P>} />
          <Route path="/signup" element={<P><SignUp /></P>} />
          <Route path="/forgot-password" element={<P><ForgotPassword /></P>} />
          <Route path="/reset-password" element={<P><ResetPassword /></P>} />

          {/* Protected customer routes */}
          <Route
            path="/account"
            element={<P><RequireAuth requireVerified><Account /></RequireAuth></P>}
          />
          <Route path="/checkout" element={<P><Checkout /></P>} />

          {/* Admin routes */}
          <Route path="/admin/login" element={<P><AdminLogin /></P>} />
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
              <Route path="about" element={<AdminAboutPage />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<P><NotFound /></P>} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
}
