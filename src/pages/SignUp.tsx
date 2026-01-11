import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Mail, Lock, User, AlertCircle, CheckCircle, Info, Sparkles, Star } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/auth/AuthProvider";
import { checkPasswordStrength } from "@/auth/auth-service";
import { FloatingElement } from "@/components/Card3D";

const signUpSchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name must be less than 50 characters")
      .regex(/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces"),
    email: z.string().email("Please enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/\d/, "Password must contain at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type SignUpFormData = z.infer<typeof signUpSchema>;

export default function SignUp() {
  const navigate = useNavigate();
  const { signUp, error, clearError } = useAuth();
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const password = watch("password");
  
  const passwordStrength = useMemo(() => {
    return checkPasswordStrength(password || "");
  }, [password]);

  const onSubmit = async (data: SignUpFormData) => {
    setIsLoading(true);
    clearError();

    try {
      await signUp(data.email, data.password, data.name);
      setSuccess(true);
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch {
      // Error is handled by AuthProvider
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/30 perspective-1500">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4 py-12 relative overflow-hidden">
          {/* Background elements */}
          <div className="absolute inset-0 pointer-events-none">
            <FloatingElement className="absolute top-1/4 left-1/4" delay={0} duration={6}>
              <div className="h-24 w-24 rounded-full bg-green-500/20 blur-3xl" />
            </FloatingElement>
            <FloatingElement className="absolute bottom-1/4 right-1/4" delay={1} duration={8}>
              <div className="h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
            </FloatingElement>
          </div>
          
          <Card className="w-full max-w-md shadow-3d-elevated glass-card animate-in zoom-in duration-500">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center glow-pulse scale-in">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div className="reveal-up stagger-1" style={{ animationFillMode: "backwards" }}>
                <h2 className="text-2xl font-bold text-3d">Account created!</h2>
                <p className="text-muted-foreground mt-2">
                  Welcome to TrendMix! A verification email has been sent to your inbox.
                </p>
              </div>
              <p className="text-sm text-muted-foreground reveal-up stagger-2" style={{ animationFillMode: "backwards" }}>
                Redirecting you to the homepage...
              </p>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/30 perspective-1500">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-12 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <FloatingElement className="absolute top-16 right-16" delay={0} duration={9}>
            <div className="h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          </FloatingElement>
          <FloatingElement className="absolute bottom-16 left-16" delay={2} duration={11}>
            <div className="h-48 w-48 rounded-full bg-secondary/10 blur-3xl" />
          </FloatingElement>
          <FloatingElement className="absolute top-1/3 left-10" delay={1} duration={7}>
            <Star className="h-6 w-6 text-primary/20" />
          </FloatingElement>
          <FloatingElement className="absolute bottom-1/3 right-10" delay={3} duration={8}>
            <Sparkles className="h-8 w-8 text-secondary/20" />
          </FloatingElement>
          <FloatingElement className="absolute top-1/2 right-1/3" delay={2} duration={10}>
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/15 to-secondary/15 rotate-45 blur-md" />
          </FloatingElement>
        </div>

        <div className="relative w-full max-w-md">
          <Card className="w-full max-w-md glass-card border-border/50 overflow-hidden relative reveal-up">
            
            <CardHeader className="space-y-1 text-center relative z-20">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center glow-pulse">
                <User className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-3d">
                Create an account
              </CardTitle>
              <CardDescription>
                Enter your details to get started
              </CardDescription>
            </CardHeader>

            <CardContent className="relative z-20">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      className="pl-10 transition-all duration-300 focus:shadow-lg focus:shadow-primary/10"
                      {...register("name")}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.name && (
                    <p className="text-sm text-destructive animate-in fade-in slide-in-from-left-2 duration-200">{errors.name.message}</p>
                  )}
                </div>

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
                  <Label htmlFor="password">Password</Label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      className="pl-10 pr-10 transition-all duration-300 focus:shadow-lg focus:shadow-primary/10"
                      {...register("password")}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive animate-in fade-in slide-in-from-left-2 duration-200">{errors.password.message}</p>
                  )}

                  {/* Password strength indicator */}
                  {password && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="flex items-center gap-2">
                        <Progress
                          value={(passwordStrength.score / 4) * 100}
                          className="h-2"
                        />
                        <span className={`text-xs font-medium transition-colors ${
                          passwordStrength.score <= 1 ? "text-red-500" :
                          passwordStrength.score === 2 ? "text-yellow-500" :
                          "text-green-500"
                        }`}>
                          {passwordStrength.label}
                        </span>
                      </div>
                      {passwordStrength.suggestions.length > 0 && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          {passwordStrength.suggestions.slice(0, 2).map((suggestion, i) => (
                            <div key={i} className="flex items-center gap-1 animate-in fade-in duration-200" style={{ animationDelay: `${i * 100}ms` }}>
                              <Info className="h-3 w-3" />
                              <span>{suggestion}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      className="pl-10 pr-10 transition-all duration-300 focus:shadow-lg focus:shadow-primary/10"
                      {...register("confirmPassword")}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive animate-in fade-in slide-in-from-left-2 duration-200">{errors.confirmPassword.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full btn-3d shine-effect relative overflow-hidden" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    <span className="relative z-10">Create account</span>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  By creating an account, you agree to our{" "}
                  <Link to="/terms" className="text-primary hover:underline transition-colors">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="text-primary hover:underline transition-colors">
                    Privacy Policy
                  </Link>
                </p>
              </form>
            </CardContent>

            <Separator />

            <CardFooter className="flex flex-col gap-4 pt-6 relative z-20">
              <p className="text-sm text-muted-foreground text-center">
                Already have an account?{" "}
                <Link to="/login" className="text-primary font-medium hover:underline transition-all hover:text-primary/80">
                  Log in
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
