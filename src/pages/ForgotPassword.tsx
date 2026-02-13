import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, Mail, ShieldCheck, Sparkles } from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { FloatingElement } from "@/components/Card3D";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

const SUCCESS_MESSAGE = "If an account exists, a password reset link has been sent.";
const REQUEST_COOLDOWN_SECONDS = 30;
const COOLDOWN_STORAGE_KEY = "trendmix_password_reset_cooldown_until";

function getReadableResetError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("network")) {
    return "Network error. Please check your connection and try again.";
  }
  if (normalized.includes("too many")) {
    return "Too many attempts. Please wait and try again.";
  }
  if (normalized.includes("invalid-email") || normalized.includes("invalid email")) {
    return "Please enter a valid email address.";
  }

  return "Unable to process the request right now. Please try again.";
}

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    const cooldownUntilRaw = sessionStorage.getItem(COOLDOWN_STORAGE_KEY);
    if (!cooldownUntilRaw) return;

    const cooldownUntil = Number(cooldownUntilRaw);
    if (!Number.isFinite(cooldownUntil)) {
      sessionStorage.removeItem(COOLDOWN_STORAGE_KEY);
      return;
    }

    const remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
    if (remaining > 0) {
      setCooldownSeconds(remaining);
    } else {
      sessionStorage.removeItem(COOLDOWN_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => {
        const next = prev > 0 ? prev - 1 : 0;
        if (next <= 0) sessionStorage.removeItem(COOLDOWN_STORAGE_KEY);
        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  const onSubmit = async (data: ForgotPasswordFormData) => {
    if (cooldownSeconds > 0) return;

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await resetPassword(data.email);

      setSuccessMessage(SUCCESS_MESSAGE);
      setCooldownSeconds(REQUEST_COOLDOWN_SECONDS);
      sessionStorage.setItem(
        COOLDOWN_STORAGE_KEY,
        String(Date.now() + REQUEST_COOLDOWN_SECONDS * 1000)
      );
    } catch (error) {
      const message = (error as { message?: string })?.message || "";
      setErrorMessage(getReadableResetError(message));
    } finally {
      setIsLoading(false);
    }
  };

  const isSubmitDisabled = isLoading || cooldownSeconds > 0;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/30">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-12 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <FloatingElement className="absolute top-20 left-10" delay={0} duration={8}>
            <div className="h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
          </FloatingElement>
          <FloatingElement className="absolute bottom-20 right-10" delay={2} duration={10}>
            <div className="h-40 w-40 rounded-full bg-secondary/10 blur-3xl" />
          </FloatingElement>
          <FloatingElement className="absolute top-1/2 left-1/4" delay={1} duration={7}>
            <Sparkles className="h-8 w-8 text-primary/20" />
          </FloatingElement>
        </div>

        <div className="relative w-full max-w-md">
          <Card className="glass-card border-border/50 overflow-hidden relative reveal-up">
            <CardHeader className="space-y-2 text-center relative z-20">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">Reset Password</CardTitle>
              <CardDescription>
                Enter your email and we&apos;ll send a secure reset link.
              </CardDescription>
            </CardHeader>

            <CardContent className="relative z-20 space-y-4">
              <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                {errorMessage && (
                  <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}

                {successMessage && (
                  <Alert className="border-green-600/30 text-green-700 dark:text-green-400">
                    <AlertDescription>{successMessage}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="forgot-password-email">Email</Label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary" />
                    <Input
                      id="forgot-password-email"
                      type="email"
                      placeholder="name@example.com"
                      className="pl-10 h-11"
                      disabled={isSubmitDisabled}
                      {...register("email")}
                    />
                  </div>
                  {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </div>

                <Button type="submit" className="w-full h-11" disabled={isSubmitDisabled}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending reset link...
                    </>
                  ) : cooldownSeconds > 0 ? (
                    `Try again in ${cooldownSeconds}s`
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </form>

              <div className="rounded-md border bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                For security, we never confirm whether an email is registered.
              </div>

              <div className="text-sm text-muted-foreground">
                Remember your password?{" "}
                <Link to="/login" className="text-primary hover:underline">
                  Back to login
                </Link>
              </div>

              <div className="text-sm text-muted-foreground">
                Need help?{" "}
                <a href="mailto:support@trendmix.live" className="text-primary hover:underline">
                  support@trendmix.live
                </a>
              </div>

              <Button type="button" variant="ghost" className="w-full" asChild>
                <Link to="/login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Return to Login
                </Link>
              </Button>
            </CardContent>
          </Card>

          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-lg blur-xl transform translate-y-4 scale-95 opacity-50" />
        </div>
      </main>

      <Footer />
    </div>
  );
}
