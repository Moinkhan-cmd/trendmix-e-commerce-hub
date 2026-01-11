/**
 * Reset Password Page
 * 
 * This page handles the password reset after user clicks the link in their email.
 * Supabase redirects here with tokens in the URL hash.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Lock,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FloatingElement } from "@/components/Card3D";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

// Password validation schema
const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

type ResetStep = "loading" | "form" | "success" | "error";

/**
 * Calculate password strength (0-100)
 */
function calculatePasswordStrength(password: string): number {
  let strength = 0;
  
  if (password.length >= 8) strength += 20;
  if (password.length >= 12) strength += 10;
  if (/[a-z]/.test(password)) strength += 15;
  if (/[A-Z]/.test(password)) strength += 15;
  if (/[0-9]/.test(password)) strength += 15;
  if (/[^A-Za-z0-9]/.test(password)) strength += 15;
  if (password.length >= 16) strength += 10;
  
  return Math.min(100, strength);
}

function getStrengthLabel(strength: number): { label: string; color: string } {
  if (strength < 30) return { label: "Weak", color: "bg-red-500" };
  if (strength < 60) return { label: "Fair", color: "bg-yellow-500" };
  if (strength < 80) return { label: "Good", color: "bg-blue-500" };
  return { label: "Strong", color: "bg-green-500" };
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // State
  const [step, setStep] = useState<ResetStep>("loading");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Form
  const form = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const watchPassword = form.watch("password");

  // Update password strength when password changes
  useEffect(() => {
    setPasswordStrength(calculatePasswordStrength(watchPassword || ""));
  }, [watchPassword]);

  // Check for session on mount (Supabase handles the token from URL automatically)
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Supabase automatically exchanges the token from the URL hash
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Session error:", error);
          setError("Invalid or expired reset link. Please request a new one.");
          setStep("error");
          return;
        }

        if (session) {
          console.log("✅ Valid session found");
          setStep("form");
        } else {
          // Listen for auth state change (token exchange happens async)
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
              console.log("Auth event:", event);
              if (event === "PASSWORD_RECOVERY" && session) {
                setStep("form");
              } else if (event === "SIGNED_IN" && session) {
                setStep("form");
              }
            }
          );

          // Give it a moment to process the URL tokens
          setTimeout(() => {
            if (step === "loading") {
              setError("Invalid or expired reset link. Please request a new one.");
              setStep("error");
            }
          }, 3000);

          return () => subscription.unsubscribe();
        }
      } catch (err) {
        console.error("Error checking session:", err);
        setError("An error occurred. Please try again.");
        setStep("error");
      }
    };

    checkSession();
  }, []);

  // Handle password update
  const handleSubmit = async (data: PasswordFormData) => {
    setIsSubmitting(true);
    setError("");

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (updateError) {
        console.error("Update error:", updateError);
        setError(updateError.message);
        return;
      }

      console.log("✅ Password updated successfully!");
      setStep("success");
      
      toast({
        title: "Password Updated!",
        description: "Your password has been changed successfully.",
      });

      // Sign out and redirect to login after 2 seconds
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate("/login");
      }, 2000);
    } catch (err) {
      console.error("Error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const strengthInfo = getStrengthLabel(passwordStrength);

  // Render content based on step
  const renderContent = () => {
    switch (step) {
      case "loading":
        return (
          <div className="text-center py-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Verifying your reset link...</p>
          </div>
        );

      case "error":
        return (
          <div className="text-center space-y-6 py-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-red-600">
                Link Invalid or Expired
              </h3>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>

            <Button
              onClick={() => navigate("/forgot-password")}
              className="w-full h-12"
            >
              Request New Reset Link
            </Button>
          </div>
        );

      case "form":
        return (
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <p className="text-sm text-muted-foreground">
              Create a strong password for your account.
            </p>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  className="pl-10 pr-10 h-12"
                  {...form.register("password")}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}

              {/* Password Strength Indicator */}
              {watchPassword && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Password strength</span>
                    <span className={strengthInfo.color.replace("bg-", "text-")}>
                      {strengthInfo.label}
                    </span>
                  </div>
                  <Progress value={passwordStrength} className="h-1.5" />
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  className="pl-10 pr-10 h-12"
                  {...form.register("confirmPassword")}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Password Requirements */}
            <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded-lg">
              <p className="font-medium">Password requirements:</p>
              <ul className="space-y-0.5 ml-2">
                <li className={watchPassword?.length >= 8 ? "text-green-600" : ""}>
                  • At least 8 characters
                </li>
                <li className={/[A-Z]/.test(watchPassword || "") ? "text-green-600" : ""}>
                  • One uppercase letter
                </li>
                <li className={/[a-z]/.test(watchPassword || "") ? "text-green-600" : ""}>
                  • One lowercase letter
                </li>
                <li className={/[0-9]/.test(watchPassword || "") ? "text-green-600" : ""}>
                  • One number
                </li>
                <li className={/[^A-Za-z0-9]/.test(watchPassword || "") ? "text-green-600" : ""}>
                  • One special character
                </li>
              </ul>
            </div>

            <Button
              type="submit"
              className="w-full h-12 btn-3d shine-effect"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Update Password
                </>
              )}
            </Button>
          </form>
        );

      case "success":
        return (
          <div className="text-center space-y-6 py-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-in zoom-in duration-300">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-green-600">
                Password Updated!
              </h3>
              <p className="text-sm text-muted-foreground">
                Your password has been changed successfully.
              </p>
              <p className="text-sm text-muted-foreground">
                Redirecting you to login...
              </p>
            </div>

            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/30">
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
        </div>

        {/* Card */}
        <div className="relative w-full max-w-md">
          <Card className="glass-card border-border/50 overflow-hidden relative">
            <CardHeader className="space-y-1 text-center relative z-20">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center glow-pulse">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">
                Reset Password
              </CardTitle>
              <CardDescription>
                Create a new password for your account
              </CardDescription>
            </CardHeader>

            <CardContent className="relative z-20">
              {renderContent()}
            </CardContent>
          </Card>

          {/* 3D shadow layer */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-lg blur-xl transform translate-y-4 scale-95 opacity-50" />
        </div>
      </main>

      <Footer />
    </div>
  );
}
