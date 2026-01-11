/**
 * Forgot Password Page - Coming Soon
 */

import { Link } from "react-router-dom";
import {
  Mail,
  ArrowLeft,
  Clock,
  Sparkles,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FloatingElement } from "@/components/Card3D";

export default function ForgotPassword() {
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
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center glow-pulse">
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">
                Coming Soon
              </CardTitle>
              <CardDescription>
                Password reset feature is under development
              </CardDescription>
            </CardHeader>

            <CardContent className="relative z-20">
              <div className="text-center space-y-6 py-4">
                <div className="space-y-3">
                  <p className="text-muted-foreground">
                    We're working hard to bring you a secure password reset feature.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    In the meantime, please contact support if you need to reset your password.
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium">Need help?</p>
                  <a 
                    href="mailto:support@trendmix.live" 
                    className="text-primary hover:underline flex items-center justify-center gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    support@trendmix.live
                  </a>
                </div>

                <Button
                  onClick={() => window.history.back()}
                  className="w-full h-12 text-base btn-3d shine-effect"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Go Back
                </Button>
              </div>
            </CardContent>

            <Separator />
            <CardFooter className="flex flex-col gap-4 pt-6 relative z-20">
              <p className="text-sm text-muted-foreground text-center">
                Remember your password?{" "}
                <Link
                  to="/login"
                  className="text-primary font-medium hover:underline transition-all hover:text-primary/80"
                >
                  Log in
                </Link>
              </p>
            </CardFooter>
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
