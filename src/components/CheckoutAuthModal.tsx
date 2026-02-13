import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Lock, ShieldCheck, BadgeCheck } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

type CheckoutAuthModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onContinueGuest?: () => void;
};

export default function CheckoutAuthModal({
  open,
  onOpenChange,
  onSuccess,
  onContinueGuest,
}: CheckoutAuthModalProps) {
  const { signIn, signUp, signInWithGoogle, resendVerificationEmail } = useAuth();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signUpForm, setSignUpForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const trustBadges = useMemo(
    () => ["Secure Payment", "Powered by Razorpay", "Encrypted Checkout"],
    []
  );

  const closeAndContinue = () => {
    onOpenChange(false);
    onSuccess();
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setIsSubmitting(true);

    try {
      await signIn(loginForm.email, loginForm.password);
      closeAndContinue();
    } catch (authError) {
      setError((authError as Error)?.message || "Unable to login. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (signUpForm.password !== signUpForm.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await signUp(signUpForm.email, signUpForm.password, signUpForm.name);
      setInfo("Account created. Please verify your email before payment.");
      closeAndContinue();
    } catch (authError) {
      setError((authError as Error)?.message || "Unable to create account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfo(null);
    setIsGoogleLoading(true);

    try {
      await signInWithGoogle();
      closeAndContinue();
    } catch (authError) {
      setError((authError as Error)?.message || "Google sign in failed. Please try again.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setError(null);
    setInfo(null);
    setIsResending(true);

    try {
      await resendVerificationEmail();
      setInfo("Verification email sent. Please check your inbox.");
    } catch (authError) {
      setError((authError as Error)?.message || "Failed to resend verification email.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl border-border/70 p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-background to-muted/30 p-6 sm:p-8">
          <DialogHeader className="space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center text-2xl">Secure Checkout — Please login to continue</DialogTitle>
            <DialogDescription className="text-center">
              Continue with one-click sign in or use your email.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {trustBadges.map((badge) => (
              <div key={badge} className="rounded-md border bg-background/80 px-3 py-2 text-xs text-center text-muted-foreground">
                {badge}
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            className="mt-5 w-full h-11"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isSubmitting}
          >
            {isGoogleLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs font-semibold">G</span>
                Continue with Google
              </>
            )}
          </Button>

          <Tabs value={tab} onValueChange={(value) => setTab(value as "login" | "signup")} className="mt-5">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Email Login</TabsTrigger>
              <TabsTrigger value="signup">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-4">
              <form className="space-y-3" onSubmit={handleLogin}>
                <div className="space-y-1.5">
                  <Label htmlFor="checkout-login-email">Email</Label>
                  <Input
                    id="checkout-login-email"
                    type="email"
                    required
                    value={loginForm.email}
                    onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="name@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="checkout-login-password">Password</Label>
                  <Input
                    id="checkout-login-password"
                    type="password"
                    required
                    value={loginForm.password}
                    onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                    placeholder="Enter password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting || isGoogleLoading}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    "Continue to Checkout"
                  )}
                </Button>
                <Button type="button" variant="link" className="h-auto p-0 text-xs" asChild>
                  <Link to="/forgot-password">Forgot your password?</Link>
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-4">
              <form className="space-y-3" onSubmit={handleSignUp}>
                <div className="space-y-1.5">
                  <Label htmlFor="checkout-signup-name">Full Name</Label>
                  <Input
                    id="checkout-signup-name"
                    required
                    value={signUpForm.name}
                    onChange={(event) => setSignUpForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="checkout-signup-email">Email</Label>
                  <Input
                    id="checkout-signup-email"
                    type="email"
                    required
                    value={signUpForm.email}
                    onChange={(event) => setSignUpForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="name@example.com"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="checkout-signup-password">Password</Label>
                    <Input
                      id="checkout-signup-password"
                      type="password"
                      required
                      value={signUpForm.password}
                      onChange={(event) => setSignUpForm((prev) => ({ ...prev, password: event.target.value }))}
                      placeholder="Password"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="checkout-signup-confirm">Confirm</Label>
                    <Input
                      id="checkout-signup-confirm"
                      type="password"
                      required
                      value={signUpForm.confirmPassword}
                      onChange={(event) => setSignUpForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                      placeholder="Confirm"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting || isGoogleLoading}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create account and continue"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={isResending || isSubmitting || isGoogleLoading}
                  onClick={handleResendVerification}
                >
                  {isResending ? "Sending verification..." : "Resend verification email"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {(error || info) && (
            <Alert className="mt-4">
              <AlertDescription>{error || info}</AlertDescription>
            </Alert>
          )}

          {onContinueGuest && (
            <div className="mt-4 rounded-lg border bg-background/70 p-3">
              <p className="text-xs text-muted-foreground mb-2">
                Prefer guest checkout? You can continue without an account and add one after payment.
              </p>
              <Button variant="secondary" className="w-full" onClick={onContinueGuest}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Continue as Guest
              </Button>
            </div>
          )}

          <div className="mt-4 flex items-center justify-center text-xs text-muted-foreground">
            <BadgeCheck className="mr-1.5 h-3.5 w-3.5" />
            Protected by industry standard encryption.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
