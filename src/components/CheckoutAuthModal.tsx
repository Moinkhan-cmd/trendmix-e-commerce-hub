import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Lock, ShieldCheck, ArrowRight } from "lucide-react";
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
      <DialogContent className="sm:max-w-[420px] border-border/60 shadow-2xl p-0 overflow-hidden max-h-[90vh] rounded-2xl">
        <div className="bg-gradient-to-b from-background to-muted/10 p-5 sm:p-6 overflow-y-auto max-h-[90vh]">
          <DialogHeader className="space-y-1.5">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/5">
              <Lock className="h-[18px] w-[18px] text-primary" />
            </div>
            <DialogTitle className="text-center text-lg font-semibold tracking-tight">Secure Checkout</DialogTitle>
            <DialogDescription className="text-center text-[13px] text-muted-foreground">
              Sign in to continue your purchase
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 shrink-0" />
            <span>Secure Payment</span>
            <span className="opacity-40">•</span>
            <span>Razorpay</span>
            <span className="opacity-40">•</span>
            <span>Encrypted</span>
          </div>

          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full h-10 rounded-lg font-medium border-border/60 hover:bg-muted/50 transition-colors"
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
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-bold">G</span>
                Continue with Google
              </>
            )}
          </Button>

          <div className="my-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-border/50" />
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground/70 font-medium">or</span>
            <div className="h-px flex-1 bg-border/50" />
          </div>

          <Tabs value={tab} onValueChange={(value) => setTab(value as "login" | "signup")} className="mt-1">
            <TabsList className="grid w-full grid-cols-2 h-9 rounded-lg bg-muted/50 p-0.5">
              <TabsTrigger value="login" className="rounded-md text-xs font-medium data-[state=active]:shadow-sm">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-md text-xs font-medium data-[state=active]:shadow-sm">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-3">
              <form className="space-y-3" onSubmit={handleLogin}>
                <div className="space-y-1.5">
                  <Label htmlFor="checkout-login-email" className="text-xs font-medium">Email</Label>
                  <Input
                    id="checkout-login-email"
                    type="email"
                    required
                    className="h-9 rounded-lg border-border/60 bg-background focus-visible:ring-primary/30"
                    value={loginForm.email}
                    onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="name@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="checkout-login-password" className="text-xs font-medium">Password</Label>
                    <Button type="button" variant="link" className="h-auto p-0 text-[11px] text-muted-foreground hover:text-primary" asChild>
                      <Link to="/forgot-password">Forgot password?</Link>
                    </Button>
                  </div>
                  <Input
                    id="checkout-login-password"
                    type="password"
                    required
                    className="h-9 rounded-lg border-border/60 bg-background focus-visible:ring-primary/30"
                    value={loginForm.password}
                    onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                    placeholder="Enter password"
                  />
                </div>
                <Button type="submit" className="w-full h-10 rounded-lg font-medium" disabled={isSubmitting || isGoogleLoading}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Continue to Checkout"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-3">
              <form className="space-y-3" onSubmit={handleSignUp}>
                <div className="space-y-1.5">
                  <Label htmlFor="checkout-signup-name" className="text-xs font-medium">Full Name</Label>
                  <Input
                    id="checkout-signup-name"
                    required
                    className="h-9 rounded-lg border-border/60 bg-background focus-visible:ring-primary/30"
                    value={signUpForm.name}
                    onChange={(event) => setSignUpForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="checkout-signup-email" className="text-xs font-medium">Email</Label>
                  <Input
                    id="checkout-signup-email"
                    type="email"
                    required
                    className="h-9 rounded-lg border-border/60 bg-background focus-visible:ring-primary/30"
                    value={signUpForm.email}
                    onChange={(event) => setSignUpForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="name@example.com"
                  />
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="checkout-signup-password" className="text-xs font-medium">Password</Label>
                    <Input
                      id="checkout-signup-password"
                      type="password"
                      required
                      className="h-9 rounded-lg border-border/60 bg-background focus-visible:ring-primary/30"
                      value={signUpForm.password}
                      onChange={(event) => setSignUpForm((prev) => ({ ...prev, password: event.target.value }))}
                      placeholder="Password"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="checkout-signup-confirm" className="text-xs font-medium">Confirm</Label>
                    <Input
                      id="checkout-signup-confirm"
                      type="password"
                      required
                      className="h-9 rounded-lg border-border/60 bg-background focus-visible:ring-primary/30"
                      value={signUpForm.confirmPassword}
                      onChange={(event) => setSignUpForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                      placeholder="Confirm"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full h-10 rounded-lg font-medium" disabled={isSubmitting || isGoogleLoading}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create Account & Continue"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full h-8 text-xs text-muted-foreground"
                  disabled={isResending || isSubmitting || isGoogleLoading}
                  onClick={handleResendVerification}
                >
                  {isResending ? "Sending verification..." : "Resend verification email"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {(error || info) && (
            <Alert className="mt-3 py-2 rounded-lg" variant={error ? "destructive" : "default"}>
              <AlertDescription className="text-xs">{error || info}</AlertDescription>
            </Alert>
          )}

          {onContinueGuest && (
            <div className="mt-4 pt-3 border-t border-border/40">
              <Button variant="ghost" className="w-full h-9 text-xs text-muted-foreground hover:text-foreground" onClick={onContinueGuest}>
                Continue as Guest
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          <p className="mt-3 text-center text-[10px] text-muted-foreground/60">
            Protected by industry-standard encryption
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
