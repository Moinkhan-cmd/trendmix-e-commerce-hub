/**
 * Forgot Password Page
 * 
 * Multi-step password reset flow:
 * 1. Email Input - User enters their email
 * 2. OTP Verification - User enters 6-digit OTP sent to email
 * 3. New Password - User sets a new password
 * 4. Success - Confirmation and redirect to login
 * 
 * Security Features:
 * - Email masking after submission
 * - OTP expiry countdown
 * - Rate limiting feedback
 * - Password strength validation
 */

import { useState, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { FloatingElement } from "@/components/Card3D";
import { OTPInput, OTPTimer } from "@/components/OTPInput";
import { PasswordStrengthIndicator, usePasswordValidation } from "@/components/PasswordStrengthIndicator";
import {
  requestPasswordReset,
  verifyOTP,
  resetPasswordWithAuth,
  maskEmail,
} from "@/auth/password-reset-service";
import type { PasswordResetStep } from "@/auth/types";
import { useToast } from "@/hooks/use-toast";

// Validation schemas
const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const passwordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/\d/, "Password must contain at least one number"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type EmailFormData = z.infer<typeof emailSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // State management
  const [step, setStep] = useState<PasswordResetStep>("email");
  const [email, setEmail] = useState("");
  const [maskedEmailDisplay, setMaskedEmailDisplay] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<number>(0);
  const [remainingResendAttempts, setRemainingResendAttempts] = useState(3);
  const [resendCooldown, setResendCooldown] = useState(0);
  
  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  // Error states
  const [error, setError] = useState("");
  const [otpError, setOtpError] = useState("");
  
  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 3D card effect state
  const [transform, setTransform] = useState("");
  const [glareStyle, setGlareStyle] = useState({});

  // Form hooks
  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const watchedPassword = passwordForm.watch("password");
  const passwordValidation = usePasswordValidation(watchedPassword || "");

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // 3D card effects
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (y - centerY) / 40;
    const rotateY = (centerX - x) / 40;
    setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`);
    
    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;
    setGlareStyle({
      background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.1) 0%, transparent 60%)`,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTransform("perspective(1000px) rotateX(0deg) rotateY(0deg)");
    setGlareStyle({});
  }, []);

  // Step 1: Request OTP
  const handleEmailSubmit = async (data: EmailFormData) => {
    setIsSubmitting(true);
    setError("");

    try {
      const result = await requestPasswordReset(data.email);
      
      setEmail(data.email);
      setMaskedEmailDisplay(result.maskedEmail);
      setOtpExpiresAt(result.expiresAt);
      setRemainingResendAttempts(result.remainingResendAttempts ?? 2);
      setResendCooldown(30); // 30 second cooldown before first resend
      setStep("otp");
      
      toast({
        title: "OTP Sent",
        description: "Please check your email for the verification code.",
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Verify OTP
  const handleOTPVerify = async (otp: string) => {
    if (otp.length !== 6) return;
    
    setIsVerifying(true);
    setOtpError("");

    try {
      const result = await verifyOTP(email, otp);
      
      if (result.success && result.token) {
        setVerificationToken(result.token);
        setStep("newPassword");
        
        toast({
          title: "OTP Verified",
          description: "Please set your new password.",
        });
      } else {
        setOtpError(result.message);
        setOtpValue(""); // Clear OTP on error
      }
    } catch (err) {
      setOtpError((err as Error).message);
      setOtpValue("");
    } finally {
      setIsVerifying(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (resendCooldown > 0 || remainingResendAttempts <= 0) return;
    
    setIsSubmitting(true);
    setOtpError("");

    try {
      const result = await requestPasswordReset(email);
      
      setOtpExpiresAt(result.expiresAt);
      setRemainingResendAttempts(result.remainingResendAttempts ?? remainingResendAttempts - 1);
      setResendCooldown(60); // 60 second cooldown after resend
      setOtpValue("");
      
      toast({
        title: "OTP Resent",
        description: "A new verification code has been sent to your email.",
      });
    } catch (err) {
      setOtpError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 3: Reset Password
  const handlePasswordSubmit = async (data: PasswordFormData) => {
    if (!passwordValidation.isValid) return;
    
    setIsResetting(true);
    setError("");

    try {
      // For demo, we'll use a simulated flow
      // In production, this would use Firebase Admin SDK or custom backend
      const result = await resetPasswordWithAuth(email, verificationToken, data.password);
      
      if (result.success) {
        setStep("success");
        
        toast({
          title: "Password Reset Successful",
          description: "You can now login with your new password.",
        });
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsResetting(false);
    }
  };

  // Handle OTP expiry
  const handleOTPExpire = useCallback(() => {
    setOtpError("OTP has expired. Please request a new one.");
    setOtpValue("");
  }, []);

  // Go back to previous step
  const handleBack = () => {
    if (step === "otp") {
      setStep("email");
      setOtpValue("");
      setOtpError("");
    } else if (step === "newPassword") {
      setStep("otp");
      setOtpValue("");
      passwordForm.reset();
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case "email":
        return (
          <form onSubmit={emailForm.handleSubmit(handleEmailSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <p className="text-sm text-muted-foreground">
              Enter your registered email address and we'll send you a verification code to reset your password.
            </p>

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  className="pl-10 h-12 text-base transition-all duration-300 focus:shadow-lg focus:shadow-primary/10"
                  {...emailForm.register("email")}
                  disabled={isSubmitting}
                />
              </div>
              {emailForm.formState.errors.email && (
                <p className="text-sm text-destructive animate-in fade-in slide-in-from-left-2 duration-200">
                  {emailForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base btn-3d shine-effect"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Send Verification Code
                </>
              )}
            </Button>
          </form>
        );

      case "otp":
        return (
          <div className="space-y-6">
            {otpError && (
              <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{otpError}</AlertDescription>
              </Alert>
            )}

            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                We've sent a 6-digit verification code to
              </p>
              <p className="font-medium">{maskedEmailDisplay}</p>
            </div>

            {/* OTP Timer */}
            <div className="flex justify-center items-center gap-2">
              <span className="text-sm text-muted-foreground">Code expires in:</span>
              <OTPTimer
                expiresAt={otpExpiresAt}
                onExpire={handleOTPExpire}
              />
            </div>

            {/* OTP Input */}
            <div className="py-4">
              <OTPInput
                value={otpValue}
                onChange={setOtpValue}
                onComplete={handleOTPVerify}
                disabled={isVerifying}
                error={!!otpError}
                autoFocus
              />
            </div>

            {/* Verify Button */}
            <Button
              onClick={() => handleOTPVerify(otpValue)}
              className="w-full h-12 text-base btn-3d shine-effect"
              disabled={isVerifying || otpValue.length !== 6}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Verify Code
                </>
              )}
            </Button>

            {/* Resend OTP */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Didn't receive the code?
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResendOTP}
                disabled={isSubmitting || resendCooldown > 0 || remainingResendAttempts <= 0}
                className="text-primary"
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : remainingResendAttempts <= 0
                  ? "No resend attempts left"
                  : `Resend Code (${remainingResendAttempts} left)`}
              </Button>
            </div>

            {/* Back Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleBack}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Change Email
            </Button>
          </div>
        );

      case "newPassword":
        return (
          <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Alert className="border-green-500 bg-green-50 dark:bg-green-950/30">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-300">
                Identity verified! Please set your new password.
              </AlertDescription>
            </Alert>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  className="pl-10 pr-10 h-12 text-base transition-all duration-300 focus:shadow-lg focus:shadow-primary/10"
                  {...passwordForm.register("password")}
                  disabled={isResetting}
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
              {passwordForm.formState.errors.password && (
                <p className="text-sm text-destructive animate-in fade-in slide-in-from-left-2 duration-200">
                  {passwordForm.formState.errors.password.message}
                </p>
              )}
            </div>

            {/* Password Strength Indicator */}
            {watchedPassword && (
              <PasswordStrengthIndicator
                password={watchedPassword}
                showRequirements
              />
            )}

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  className="pl-10 pr-10 h-12 text-base transition-all duration-300 focus:shadow-lg focus:shadow-primary/10"
                  {...passwordForm.register("confirmPassword")}
                  disabled={isResetting}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive animate-in fade-in slide-in-from-left-2 duration-200">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-12 text-base btn-3d shine-effect"
              disabled={isResetting || !passwordValidation.isValid}
            >
              {isResetting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting Password...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Reset Password
                </>
              )}
            </Button>

            {/* Back Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleBack}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
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
                Password Reset Successful!
              </h3>
              <p className="text-sm text-muted-foreground">
                Your password has been successfully reset. You can now login with your new password.
              </p>
            </div>

            <Button
              onClick={() => navigate("/login")}
              className="w-full h-12 text-base btn-3d shine-effect"
            >
              <Lock className="mr-2 h-4 w-4" />
              Go to Login
            </Button>
          </div>
        );
    }
  };

  // Get step icon and title
  const getStepInfo = () => {
    switch (step) {
      case "email":
        return { icon: Mail, title: "Forgot Password", description: "Reset your account password" };
      case "otp":
        return { icon: KeyRound, title: "Verify Your Identity", description: "Enter the code sent to your email" };
      case "newPassword":
        return { icon: Lock, title: "Create New Password", description: "Set a strong password for your account" };
      case "success":
        return { icon: CheckCircle, title: "Success!", description: "Your password has been reset" };
    }
  };

  const stepInfo = getStepInfo();
  const StepIcon = stepInfo.icon;

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

        {/* Card with 3D effect */}
        <div
          className="relative preserve-3d w-full max-w-md"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            transform,
            transition: "transform 0.2s ease-out",
          }}
        >
          <Card className="shadow-3d-elevated glass-card border-border/50 overflow-hidden relative">
            {/* Glare effect */}
            <div
              className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-300"
              style={glareStyle}
            />

            <CardHeader className="space-y-1 text-center relative z-0">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center glow-pulse">
                <StepIcon className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">
                {stepInfo.title}
              </CardTitle>
              <CardDescription>{stepInfo.description}</CardDescription>
            </CardHeader>

            {/* Step Indicator */}
            {step !== "success" && (
              <div className="px-6 pb-4">
                <div className="flex items-center justify-center gap-2">
                  {["email", "otp", "newPassword"].map((s, index) => (
                    <div key={s} className="flex items-center">
                      <div
                        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                          step === s
                            ? "bg-primary scale-125"
                            : ["email", "otp", "newPassword"].indexOf(step) > index
                            ? "bg-primary/50"
                            : "bg-muted"
                        }`}
                      />
                      {index < 2 && (
                        <div
                          className={`w-8 h-0.5 mx-1 transition-all duration-300 ${
                            ["email", "otp", "newPassword"].indexOf(step) > index
                              ? "bg-primary/50"
                              : "bg-muted"
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <CardContent className="relative z-0">
              {renderStepContent()}
            </CardContent>

            {step === "email" && (
              <>
                <Separator />
                <CardFooter className="flex flex-col gap-4 pt-6 relative z-0">
                  <p className="text-sm text-muted-foreground text-center">
                    Remember your password?{" "}
                    <Link
                      to="/login"
                      className="text-primary font-medium hover:underline transition-all hover:text-primary/80"
                    >
                      Sign in
                    </Link>
                  </p>
                </CardFooter>
              </>
            )}
          </Card>

          {/* 3D shadow layer */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-lg blur-xl transform translate-y-4 scale-95 opacity-50" />
        </div>
      </main>

      {/* Sticky action button for mobile */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t safe-area-bottom">
        <Link to="/login">
          <Button variant="outline" className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Login
          </Button>
        </Link>
      </div>

      <Footer />
    </div>
  );
}
