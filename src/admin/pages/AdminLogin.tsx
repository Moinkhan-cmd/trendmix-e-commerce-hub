import { useEffect, useMemo, useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useLocation, useNavigate, type Location } from "react-router-dom";
import { auth } from "@/lib/firebase";
import { isUidAdmin } from "@/admin/services/admin";
import { getAuthErrorMessage } from "@/auth/auth-service";
import { useAdminAuth } from "@/admin/AdminAuthProvider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Eye, EyeOff, Loader2, ShieldAlert } from "lucide-react";

function getSafeRedirectPath(fromPath: unknown) {
  if (typeof fromPath !== "string") return "/admin";
  if (!fromPath.startsWith("/admin")) return "/admin";
  if (fromPath === "/admin/login") return "/admin";
  return fromPath;
}

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, loading: authLoading } = useAdminAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  type AdminLoginLocationState = {
    reason?: string;
    from?: Location;
  };

  const state = location.state as AdminLoginLocationState | null;
  const reason = state?.reason;
  const fromPath = state?.from?.pathname;

  const safeFromPath = useMemo(() => getSafeRedirectPath(fromPath), [fromPath]);

  const banner = useMemo(() => {
    if (reason === "not-admin") {
      return "This account is not an admin. Ask the owner to add your UID to Firestore admins/{uid}.";
    }
    return null;
  }, [reason]);

  useEffect(() => {
    if (authLoading) return;
    if (user && isAdmin) {
      navigate(safeFromPath, { replace: true });
    }
  }, [authLoading, user, isAdmin, navigate, safeFromPath]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      const ok = await isUidAdmin(cred.user.uid);
      if (!ok) {
        await signOut(auth);
        setError("Not authorized: this user is not in admins/{uid}.");
        return;
      }

      navigate(safeFromPath, { replace: true });
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin Login</CardTitle>
          <CardDescription>Sign in with your admin email and password.</CardDescription>
        </CardHeader>
        <CardContent>
          {banner && (
            <Alert className="mb-4">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Admin required</AlertTitle>
              <AlertDescription>{banner}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Login error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
