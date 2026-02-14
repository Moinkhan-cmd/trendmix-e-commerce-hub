import { useEffect, useState } from "react";
import {
  CheckCircle,
  XCircle,
  Loader2,
  CreditCard,
  Smartphone,
  Shield,
  RefreshCw,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/orders";
import type { PaymentMethod } from "@/lib/payment";

type PaymentStatus = "processing" | "success" | "failed";

type PaymentProcessingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  amount: number;
  transactionId?: string;
  errorMessage?: string;
  onRetry?: () => void;
  onContinue?: () => void;
};

const PROCESSING_MESSAGES = [
  "Connecting to payment gateway...",
  "Verifying payment details...",
  "Processing transaction...",
  "Confirming payment...",
];

export default function PaymentProcessingModal({
  open,
  onOpenChange,
  status,
  paymentMethod,
  amount,
  transactionId,
  errorMessage,
  onRetry,
  onContinue,
}: PaymentProcessingModalProps) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  // Animate progress when processing
  useEffect(() => {
    if (status !== "processing") {
      setProgress(status === "success" ? 100 : 0);
      return;
    }

    setProgress(0);
    setMessageIndex(0);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 500);

    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % PROCESSING_MESSAGES.length);
    }, 1500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    };
  }, [status]);

  const getPaymentMethodIcon = () => {
    switch (paymentMethod) {
      case "card":
        return <CreditCard className="h-6 w-6" />;
      case "upi":
        return <Smartphone className="h-6 w-6" />;
      default:
        return <Shield className="h-6 w-6" />;
    }
  };

  const getPaymentMethodLabel = () => {
    switch (paymentMethod) {
      case "card":
        return "Card Payment";
      case "upi":
        return "UPI Payment";
      case "cod":
        return "Cash on Delivery";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => status === "processing" && e.preventDefault()}
      >
        {/* Processing State */}
        {status === "processing" && (
          <>
            <DialogHeader className="text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <div className="relative">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {getPaymentMethodIcon()}
                  </div>
                </div>
              </div>
              <DialogTitle className="text-xl">Processing Payment</DialogTitle>
              <DialogDescription className="text-base">
                Please wait while we process your payment of{" "}
                <strong className="text-foreground">{formatCurrency(amount)}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-3">
              <Progress value={progress} className="h-2" />
              <p className="text-center text-sm text-muted-foreground animate-pulse">
                {PROCESSING_MESSAGES[messageIndex]}
              </p>
            </div>

            <div className="mt-4 p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Shield className="h-3 w-3" />
                Your payment is secure and encrypted
              </p>
            </div>
          </>
        )}

        {/* Success State */}
        {status === "success" && (
          <>
            <DialogHeader className="text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400 animate-[scale-in_0.3s_ease-out]" />
              </div>
              <DialogTitle className="text-xl text-green-700 dark:text-green-300">
                Payment Successful!
              </DialogTitle>
              <DialogDescription className="text-base">
                Your payment of{" "}
                <strong className="text-foreground">{formatCurrency(amount)}</strong>{" "}
                has been processed successfully.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-3">
              <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payment Method</span>
                  <span className="font-medium flex items-center gap-2">
                    {getPaymentMethodIcon()}
                    {getPaymentMethodLabel()}
                  </span>
                </div>
                {transactionId && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Transaction ID</span>
                    <span className="font-mono text-xs bg-background px-2 py-1 rounded">
                      {transactionId}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount Paid</span>
                  <span className="font-bold text-green-600">{formatCurrency(amount)}</span>
                </div>
              </div>
            </div>

            <Button onClick={onContinue} className="w-full mt-4" size="lg">
              <CheckCircle className="mr-2 h-4 w-4" />
              Continue to Order Confirmation
            </Button>
          </>
        )}

        {/* Failed State */}
        {status === "failed" && (
          <>
            <DialogHeader className="text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
              </div>
              <DialogTitle className="text-xl text-red-700 dark:text-red-300">
                Payment Failed
              </DialogTitle>
              <DialogDescription className="text-base">
                {errorMessage || "We couldn't process your payment. Please try again."}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300 text-center">
                Your card has not been charged. You can try again with a different payment method.
              </p>
            </div>

            <div className="flex flex-col gap-3 mt-4">
              <Button onClick={onRetry} size="lg">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                size="lg"
              >
                Change Payment Method
              </Button>
            </div>
          </>
        )}

      </DialogContent>
    </Dialog>
  );
}

// Add keyframe animation for success checkmark
const style = document.createElement("style");
style.textContent = `
  @keyframes scale-in {
    from {
      transform: scale(0);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }
`;
if (typeof document !== "undefined") {
  document.head.appendChild(style);
}
