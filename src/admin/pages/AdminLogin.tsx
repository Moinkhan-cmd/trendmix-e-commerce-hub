import { useMemo, useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useLocation, useNavigate } from "react-router-dom";
import { auth } from "@/lib/firebase";
import { isUidAdmin } from "@/admin/services/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ShieldAlert } from "lucide-react";

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reason = (location.state as any)?.reason as string | undefined;
  const fromPath = (location.state as any)?.from?.pathname as string | undefined;

  const banner = useMemo(() => {
    if (reason === "not-admin") {
      return "This account is not an admin. Ask the owner to add your UID to Firestore admins/{uid}.";
    }
    return null;
  }, [reason]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const ok = await isUidAdmin(cred.user.uid);
      if (!ok) {
        await signOut(auth);
        setError("Not authorized: this user is not in admins/{uid}.");
        return;
      }

      navigate(fromPath || "/admin", { replace: true });
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin Login</CardTitle>
          <CardDescription>
            Sign in with your admin email and password.
          </CardDescription>
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
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
