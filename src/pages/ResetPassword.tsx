import { Link } from "react-router-dom";
import { ArrowLeft, MailCheck, ShieldCheck, Sparkles } from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { FloatingElement } from "@/components/Card3D";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ResetPassword() {
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
              <CardDescription>Trendmix uses Firebase&apos;s secure password reset flow.</CardDescription>
            </CardHeader>

            <CardContent className="relative z-20 space-y-4">
              <div className="rounded-md border bg-background/80 p-3 text-sm text-muted-foreground">
                Use the reset link sent to your email. If it expired, request a new one.
              </div>

              <Button className="w-full" asChild>
                <Link to="/forgot-password">
                  <MailCheck className="mr-2 h-4 w-4" />
                  Request New Reset Link
                </Link>
              </Button>

              <Button type="button" variant="ghost" className="w-full" asChild>
                <Link to="/login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Return to Login
                </Link>
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Need help? <a href="mailto:support@trendmix.live" className="text-primary hover:underline">support@trendmix.live</a>
              </p>
            </CardContent>
          </Card>

          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-lg blur-xl transform translate-y-4 scale-95 opacity-50" />
        </div>
      </main>

      <Footer />
    </div>
  );
}
