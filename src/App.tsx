import { useEffect } from 'react';

import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, useLocation } from 'react-router-dom';

import { AuthProvider } from '@/auth/AuthProvider';
import { AdminAuthProvider } from '@/admin/AdminAuthProvider';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import AnimatedRoutes from '@/components/AnimatedRoutes';

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
              <AnimatedRoutes />
            </AppErrorBoundary>
          </BrowserRouter>
        </AdminAuthProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
