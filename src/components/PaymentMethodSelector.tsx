import {
  Banknote,
  Lock,
  ShieldCheck,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  type PaymentMethod,
  type CardDetails,
  type UpiDetails,
} from "@/lib/payment";

type PaymentMethodSelectorProps = {
  selectedMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  cardDetails?: CardDetails;
  onCardDetailsChange?: (details: CardDetails) => void;
  upiDetails?: UpiDetails;
  onUpiDetailsChange?: (details: UpiDetails) => void;
  errors?: {
    cardNumber?: string;
    expiryDate?: string;
    cvv?: string;
    cardholderName?: string;
    upiId?: string;
  };
  disabled?: boolean;
  showCod?: boolean;
};

const PAYMENT_METHODS = [
  {
    id: "razorpay" as const,
    name: "Pay Online (Razorpay)",
    description: "Cards, UPI, Netbanking, Wallets",
    icon: ShieldCheck,
    recommended: true,
  },
  {
    id: "cod" as const,
    name: "Cash on Delivery",
    description: "Pay when you receive",
    icon: Banknote,
  },
];

// COD enabled with ₹29 fee. Minimum order ₹399 to reduce fake orders.
const COD_FEE = 29;

export default function PaymentMethodSelector({
  selectedMethod,
  onMethodChange,
  disabled = false,
  showCod = false,
}: PaymentMethodSelectorProps) {
  const visiblePaymentMethods = PAYMENT_METHODS.filter(
    (method) => showCod || method.id !== "cod"
  );

  return (
    <div className="space-y-4">
      {/* Payment Method Selection */}
      <RadioGroup
        value={selectedMethod}
        onValueChange={(value) => onMethodChange(value as PaymentMethod)}
        className="grid gap-3"
        disabled={disabled}
      >
        {visiblePaymentMethods.map((method) => {
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
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{method.name}</p>
                    {"recommended" in method && method.recommended && (
                      <Badge className="bg-green-600 hover:bg-green-600 text-[10px] px-1.5 py-0">
                        Recommended
                      </Badge>
                    )}
                  </div>
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

      {/* Razorpay Info */}
      {selectedMethod === "razorpay" && (
        <Card className="mt-4 border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="font-medium text-indigo-800 dark:text-indigo-200">
                  Secure Razorpay Checkout
                </p>
                <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">
                  You'll be redirected to Razorpay's secure payment page. Pay via Cards, UPI, Netbanking, or Wallets — all in one place.
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <Lock className="h-3 w-3 text-indigo-500" />
                  <span className="text-xs text-indigo-600 dark:text-indigo-400">
                    256-bit SSL encrypted &amp; PCI DSS compliant
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* COD Info */}
      {showCod && selectedMethod === "cod" && (
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
                  Pay with cash when your order arrives. Cash Handling &amp; Logistics Fee: ₹{COD_FEE}.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


