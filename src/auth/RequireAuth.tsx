import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { Loader2 } from "lucide-react";

interface RequireAuthProps {
  children?: React.ReactNode;
  requireAdmin?: boolean;
  requireVerified?: boolean;
}

export function RequireAuth({
  children,
  requireAdmin = false,
  requireVerified = false,
}: RequireAuthProps) {
  const { user, isAuthenticated, isEmailVerified, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (requireVerified && user && !isEmailVerified) {
    return (
      <Navigate
        to="/login"
        state={{ from: location, verificationRequired: true }}
        replace
      />
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

export default RequireAuth;
