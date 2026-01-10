import { useState, useEffect } from "react";
import {
  CreditCard,
  Smartphone,
  Banknote,
  Lock,
  AlertCircle,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  formatCardNumber,
  formatExpiryDate,
  getCardType,
  validateCardNumber,
  validateExpiryDate,
  validateCVV,
  validateUpiId,
  TEST_CARDS,
  TEST_UPI,
  type PaymentMethod,
  type CardDetails,
  type UpiDetails,
} from "@/lib/payment";

type PaymentMethodSelectorProps = {
  selectedMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  cardDetails: CardDetails;
  onCardDetailsChange: (details: CardDetails) => void;
  upiDetails: UpiDetails;
  onUpiDetailsChange: (details: UpiDetails) => void;
  errors?: {
    cardNumber?: string;
    expiryDate?: string;
    cvv?: string;
    cardholderName?: string;
    upiId?: string;
  };
  disabled?: boolean;
};

const PAYMENT_METHODS = [
  {
    id: "card" as const,
    name: "Credit / Debit Card",
    description: "Visa, Mastercard, RuPay",
    icon: CreditCard,
  },
  {
    id: "upi" as const,
    name: "UPI",
    description: "Google Pay, PhonePe, Paytm",
    icon: Smartphone,
  },
  {
    id: "cod" as const,
    name: "Cash on Delivery",
    description: "Pay when you receive",
    icon: Banknote,
  },
];

// Card type icons (using simple colored squares for demo)
function CardTypeIcon({ type }: { type: "visa" | "mastercard" | "amex" | "unknown" }) {
  const colors = {
    visa: "bg-blue-600",
    mastercard: "bg-gradient-to-r from-red-500 to-yellow-500",
    amex: "bg-blue-400",
    unknown: "bg-gray-400",
  };

  const labels = {
    visa: "VISA",
    mastercard: "MC",
    amex: "AMEX",
    unknown: "",
  };

  if (type === "unknown") return null;

  return (
    <span className={cn("px-2 py-0.5 text-[10px] font-bold text-white rounded", colors[type])}>
      {labels[type]}
    </span>
  );
}

export default function PaymentMethodSelector({
  selectedMethod,
  onMethodChange,
  cardDetails,
  onCardDetailsChange,
  upiDetails,
  onUpiDetailsChange,
  errors = {},
  disabled = false,
}: PaymentMethodSelectorProps) {
  const [cardType, setCardType] = useState<"visa" | "mastercard" | "amex" | "unknown">("unknown");

  useEffect(() => {
    setCardType(getCardType(cardDetails.cardNumber));
  }, [cardDetails.cardNumber]);

  const handleCardNumberChange = (value: string) => {
    const formatted = formatCardNumber(value);
    onCardDetailsChange({ ...cardDetails, cardNumber: formatted });
  };

  const handleExpiryChange = (value: string) => {
    const formatted = formatExpiryDate(value);
    onCardDetailsChange({ ...cardDetails, expiryDate: formatted });
  };

  return (
    <div className="space-y-4">
      {/* Demo Mode Banner */}
      <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
          <strong>Demo Mode:</strong> This is a simulated payment system. No real transactions will occur.
        </AlertDescription>
      </Alert>

      {/* Payment Method Selection */}
      <RadioGroup
        value={selectedMethod}
        onValueChange={(value) => onMethodChange(value as PaymentMethod)}
        className="grid gap-3"
        disabled={disabled}
      >
        {PAYMENT_METHODS.map((method) => {
          const Icon = method.icon;
          const isSelected = selectedMethod === method.id;

          return (
            <div key={method.id}>
              <RadioGroupItem
                value={method.id}
                id={method.id}
                className="peer sr-only"
              />
              <label
                htmlFor={method.id}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all",
                  "hover:bg-accent/50",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-muted",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{method.name}</p>
                  <p className="text-sm text-muted-foreground">{method.description}</p>
                </div>
                {isSelected && (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-white" />
                  </div>
                )}
              </label>
            </div>
          );
        })}
      </RadioGroup>

      {/* Card Payment Form */}
      {selectedMethod === "card" && (
        <Card className="mt-4 border-primary/20">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <Lock className="h-3 w-3" />
                Secure Card Details
              </span>
              <Badge variant="outline" className="text-xs">
                🔒 Demo Only
              </Badge>
            </div>

            {/* Test Card Info */}
            <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
              <p className="font-medium text-muted-foreground">Test Cards:</p>
              <p>✅ Success: <code className="bg-background px-1 rounded">{TEST_CARDS.SUCCESS}</code></p>
              <p>❌ Decline: <code className="bg-background px-1 rounded">{TEST_CARDS.DECLINE}</code></p>
            </div>

            {/* Card Number */}
            <div className="space-y-2">
              <Label htmlFor="cardNumber">Card Number</Label>
              <div className="relative">
                <Input
                  id="cardNumber"
                  placeholder="1234 5678 9012 3456"
                  value={cardDetails.cardNumber}
                  onChange={(e) => handleCardNumberChange(e.target.value)}
                  className={cn(
                    "pr-16 font-mono text-base",
                    errors.cardNumber && "border-destructive"
                  )}
                  disabled={disabled}
                  maxLength={19}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <CardTypeIcon type={cardType} />
                </div>
              </div>
              {errors.cardNumber && (
                <p className="text-sm text-destructive">{errors.cardNumber}</p>
              )}
            </div>

            {/* Cardholder Name */}
            <div className="space-y-2">
              <Label htmlFor="cardholderName">Cardholder Name</Label>
              <Input
                id="cardholderName"
                placeholder="John Doe"
                value={cardDetails.cardholderName}
                onChange={(e) =>
                  onCardDetailsChange({ ...cardDetails, cardholderName: e.target.value })
                }
                className={cn(errors.cardholderName && "border-destructive")}
                disabled={disabled}
              />
              {errors.cardholderName && (
                <p className="text-sm text-destructive">{errors.cardholderName}</p>
              )}
            </div>

            {/* Expiry and CVV */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input
                  id="expiryDate"
                  placeholder="MM/YY"
                  value={cardDetails.expiryDate}
                  onChange={(e) => handleExpiryChange(e.target.value)}
                  className={cn(
                    "font-mono",
                    errors.expiryDate && "border-destructive"
                  )}
                  disabled={disabled}
                  maxLength={5}
                />
                {errors.expiryDate && (
                  <p className="text-sm text-destructive">{errors.expiryDate}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cvv">CVV</Label>
                <Input
                  id="cvv"
                  type="password"
                  placeholder="•••"
                  value={cardDetails.cvv}
                  onChange={(e) =>
                    onCardDetailsChange({
                      ...cardDetails,
                      cvv: e.target.value.replace(/\D/g, "").slice(0, 3),
                    })
                  }
                  className={cn(
                    "font-mono",
                    errors.cvv && "border-destructive"
                  )}
                  disabled={disabled}
                  maxLength={3}
                />
                {errors.cvv && (
                  <p className="text-sm text-destructive">{errors.cvv}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* UPI Payment Form */}
      {selectedMethod === "upi" && (
        <Card className="mt-4 border-primary/20">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <Smartphone className="h-3 w-3" />
                UPI Payment
              </span>
              <Badge variant="outline" className="text-xs">
                🔒 Demo Only
              </Badge>
            </div>

            {/* Test UPI Info */}
            <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
              <p className="font-medium text-muted-foreground">Test UPI IDs:</p>
              <p>✅ Success: <code className="bg-background px-1 rounded">{TEST_UPI.SUCCESS}</code></p>
              <p>❌ Failure: <code className="bg-background px-1 rounded">{TEST_UPI.FAILURE}</code></p>
            </div>

            {/* UPI ID */}
            <div className="space-y-2">
              <Label htmlFor="upiId">UPI ID</Label>
              <Input
                id="upiId"
                placeholder="yourname@upi"
                value={upiDetails.upiId}
                onChange={(e) => onUpiDetailsChange({ upiId: e.target.value })}
                className={cn(errors.upiId && "border-destructive")}
                disabled={disabled}
              />
              {errors.upiId && (
                <p className="text-sm text-destructive">{errors.upiId}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Enter your UPI ID (e.g., name@paytm, name@okicici)
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* COD Info */}
      {selectedMethod === "cod" && (
        <Card className="mt-4 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                <Banknote className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">
                  Cash on Delivery Selected
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Pay with cash when your order arrives. Please keep exact change ready.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Export validation functions for use in forms
export { validateCardNumber, validateExpiryDate, validateCVV, validateUpiId };
