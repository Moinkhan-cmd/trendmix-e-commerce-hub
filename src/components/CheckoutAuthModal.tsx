import { useState } from "react";
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
      <DialogContent className="sm:max-w-md border-border/70 shadow-xl p-0 overflow-hidden max-h-[90vh]">
        <div className="bg-gradient-to-br from-background via-background to-muted/20 p-4 sm:p-5 overflow-y-auto max-h-[90vh]">
          <DialogHeader className="space-y-1.5">
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-4.5 w-4.5 text-primary" />
            </div>
            <DialogTitle className="text-center text-lg sm:text-xl">Secure Checkout</DialogTitle>
            <DialogDescription className="text-center text-sm">
              Please login to continue.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 rounded-md border border-border/70 bg-background/70 px-3 py-1.5 text-[11px] text-muted-foreground text-center">
            Secure Payment • Razorpay • Encrypted Checkout
          </div>

          <Button
            type="button"
            variant="outline"
            className="mt-3 w-full h-9"
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

          <div className="my-2 flex items-center gap-2">
            <div className="h-px flex-1 bg-border/70" />
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border/70" />
          </div>

          <Tabs value={tab} onValueChange={(value) => setTab(value as "login" | "signup")} className="mt-2.5">
            <TabsList className="grid w-full grid-cols-2 h-9 rounded-lg bg-muted/60 p-1">
              <TabsTrigger value="login">Email Login</TabsTrigger>
              <TabsTrigger value="signup">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-3">
              <form className="space-y-2.5" onSubmit={handleLogin}>
                <div className="space-y-1">
                  <Label htmlFor="checkout-login-email" className="text-xs">Email</Label>
                  <Input
                    id="checkout-login-email"
                    type="email"
                    required
                    className="h-9 bg-background/90"
                    value={loginForm.email}
                    onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="name@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="checkout-login-password" className="text-xs">Password</Label>
                  <Input
                    id="checkout-login-password"
                    type="password"
                    required
                    className="h-9 bg-background/90"
                    value={loginForm.password}
                    onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                    placeholder="Enter password"
                  />
                </div>
                <Button type="submit" className="w-full h-9" disabled={isSubmitting || isGoogleLoading}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    "Continue to Checkout"
                  )}
                </Button>
                <Button type="button" variant="link" className="h-auto p-0 text-[11px]" asChild>
                  <Link to="/forgot-password">Forgot your password?</Link>
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-3">
              <form className="space-y-2.5" onSubmit={handleSignUp}>
                <div className="space-y-1">
                  <Label htmlFor="checkout-signup-name" className="text-xs">Full Name</Label>
                  <Input
                    id="checkout-signup-name"
                    required
                    className="h-9 bg-background/90"
                    value={signUpForm.name}
                    onChange={(event) => setSignUpForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="checkout-signup-email" className="text-xs">Email</Label>
                  <Input
                    id="checkout-signup-email"
                    type="email"
                    required
                    className="h-9 bg-background/90"
                    value={signUpForm.email}
                    onChange={(event) => setSignUpForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="name@example.com"
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="checkout-signup-password" className="text-xs">Password</Label>
                    <Input
                      id="checkout-signup-password"
                      type="password"
                      required
                      className="h-9 bg-background/90"
                      value={signUpForm.password}
                      onChange={(event) => setSignUpForm((prev) => ({ ...prev, password: event.target.value }))}
                      placeholder="Password"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="checkout-signup-confirm" className="text-xs">Confirm</Label>
                    <Input
                      id="checkout-signup-confirm"
                      type="password"
                      required
                      className="h-9 bg-background/90"
                      value={signUpForm.confirmPassword}
                      onChange={(event) => setSignUpForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                      placeholder="Confirm"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full h-9" disabled={isSubmitting || isGoogleLoading}>
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
                  className="w-full h-9"
                  disabled={isResending || isSubmitting || isGoogleLoading}
                  onClick={handleResendVerification}
                >
                  {isResending ? "Sending verification..." : "Resend verification email"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {(error || info) && (
            <Alert className="mt-3 py-2">
              <AlertDescription>{error || info}</AlertDescription>
            </Alert>
          )}

          {onContinueGuest && (
            <div className="mt-3 rounded-lg border border-border/70 bg-background/70 p-2.5">
              <p className="text-[11px] text-muted-foreground mb-1.5 text-center">
                Prefer guest checkout?
              </p>
              <Button variant="outline" className="w-full h-9" onClick={onContinueGuest}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Continue as Guest
              </Button>
            </div>
          )}

          <div className="mt-3 flex items-center justify-center text-[11px] text-muted-foreground">
            <BadgeCheck className="mr-1.5 h-3.5 w-3.5" />
            Protected by industry standard encryption.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
