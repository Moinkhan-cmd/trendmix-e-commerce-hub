import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Mail, Lock, AlertCircle, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/auth/AuthProvider";
import { FloatingElement } from "@/components/Card3D";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    signIn,
    error,
    clearError,
    verificationRequired,
    resendVerificationEmail,
    refreshVerificationStatus,
    clearVerificationRequired,
    isEmailVerified,
    user,
  } = useAuth();
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [localVerificationRequired, setLocalVerificationRequired] = useState(false);

  useEffect(() => {
    const state = location.state as { verificationRequired?: boolean } | null;
    if (state?.verificationRequired) {
      setLocalVerificationRequired(true);
    }
  }, [location.state]);

  useEffect(() => {
    if (user?.emailVerified || isEmailVerified) {
      setLocalVerificationRequired(false);
      clearVerificationRequired();
    }
  }, [user?.emailVerified, isEmailVerified, clearVerificationRequired]);

  const from = (location.state as { from?: Location })?.from?.pathname || "/";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setResendMessage(null);
    clearError();

    try {
      await signIn(data.email, data.password);
      navigate(from, { replace: true });
    } catch {
      // Error is handled by AuthProvider
    } finally {
      setIsLoading(false);
    }
  };

  const shouldShowVerificationAlert = verificationRequired || localVerificationRequired;

  const handleResendVerification = async () => {
    setIsResending(true);
    setResendMessage(null);
    clearError();

    try {
      await resendVerificationEmail();
      setResendMessage("Verification email sent. Please check your inbox.");
      await refreshVerificationStatus();
    } catch {
      // Error is handled by AuthProvider
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/30 perspective-1500">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-12 relative overflow-hidden">
        {/* Animated background elements */}
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
          <FloatingElement className="absolute top-1/3 right-1/4" delay={3} duration={9}>
            <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 rotate-45 blur-lg" />
          </FloatingElement>
        </div>

        <div className="relative w-full max-w-md">
          <Card className="w-full max-w-md glass-card border-border/50 overflow-hidden relative reveal-up">
            
            <CardHeader className="space-y-1 text-center relative z-20">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center glow-pulse">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-3d">
                Welcome back
              </CardTitle>
              <CardDescription>
                Log in to your account to continue
              </CardDescription>
            </CardHeader>

            <CardContent className="relative z-20">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {shouldShowVerificationAlert && (
                    <Alert className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="space-y-3">
                        <p>Please verify your email before logging in.</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleResendVerification}
                          disabled={isResending || !user}
                          className="w-full"
                        >
                          {isResending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Sending verification email...
                            </>
                          ) : (
                            "Resend verification email"
                          )}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  {resendMessage && (
                    <Alert className="animate-in fade-in slide-in-from-top-2 duration-300 border-green-600/30 text-green-700 dark:text-green-400">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{resendMessage}</AlertDescription>
                    </Alert>
                  )}

                  {error && (
                    <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative group">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="name@example.com"
                        className="pl-10 transition-all duration-300 focus:shadow-lg focus:shadow-primary/10"
                        {...register("email")}
                        disabled={isLoading}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-destructive animate-in fade-in slide-in-from-left-2 duration-200">{errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <Link
                        to="/forgot-password"
                        className="text-sm text-primary hover:underline transition-colors hover:text-primary/80"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        className="pl-10 pr-10 transition-all duration-300 focus:shadow-lg focus:shadow-primary/10"
                        {...register("password")}
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-sm text-destructive animate-in fade-in slide-in-from-left-2 duration-200">{errors.password.message}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full btn-3d shine-effect relative overflow-hidden group" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Logging in...
                      </>
                    ) : (
                      <span className="relative z-10">Log in</span>
                    )}
                  </Button>
                </form>
            </CardContent>

            <Separator />

            <CardFooter className="flex flex-col gap-4 pt-6 relative z-20">
              <p className="text-sm text-muted-foreground text-center">
                Don't have an account?{" "}
                <Link to="/signup" className="text-primary font-medium hover:underline transition-all hover:text-primary/80">
                  Create account
                </Link>
              </p>
            </CardFooter>
          </Card>
          
          {/* 3D shadow layer */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-lg blur-xl transform translate-y-4 scale-95 opacity-50" />
        </div>
      </main>

      <Footer />
    </div>
  );
}
