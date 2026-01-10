import { Check, ShoppingCart, MapPin, CreditCard, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type CheckoutStep = "cart" | "address" | "payment" | "confirmation";

type CheckoutStepsProps = {
  currentStep: CheckoutStep;
  className?: string;
};

const STEPS = [
  { id: "cart" as const, label: "Cart", icon: ShoppingCart },
  { id: "address" as const, label: "Address", icon: MapPin },
  { id: "payment" as const, label: "Payment", icon: CreditCard },
  { id: "confirmation" as const, label: "Confirmation", icon: CheckCircle },
];

const STEP_ORDER: CheckoutStep[] = ["cart", "address", "payment", "confirmation"];

function getStepIndex(step: CheckoutStep): number {
  return STEP_ORDER.indexOf(step);
}

export default function CheckoutSteps({ currentStep, className }: CheckoutStepsProps) {
  const currentIndex = getStepIndex(currentStep);

  return (
    <div className={cn("w-full", className)}>
      {/* Desktop Version */}
      <div className="hidden sm:flex items-center justify-center">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isUpcoming = index > currentIndex;

          return (
            <div key={step.id} className="flex items-center">
              {/* Step Circle */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                    isCompleted && "bg-primary border-primary text-primary-foreground",
                    isCurrent && "border-primary bg-primary/10 text-primary",
                    isUpcoming && "border-muted bg-muted/50 text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={cn(
                    "mt-2 text-xs font-medium",
                    isCompleted && "text-primary",
                    isCurrent && "text-primary font-semibold",
                    isUpcoming && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector Line */}
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-16 mx-2 transition-all duration-300",
                    index < currentIndex ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile Version */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isUpcoming = index > currentIndex;

            return (
              <div key={step.id} className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300",
                    isCompleted && "bg-primary border-primary text-primary-foreground",
                    isCurrent && "border-primary bg-primary/10 text-primary",
                    isUpcoming && "border-muted bg-muted/50 text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="relative h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-primary transition-all duration-500"
            style={{ width: `${(currentIndex / (STEPS.length - 1)) * 100}%` }}
          />
        </div>

        {/* Current Step Label */}
        <p className="text-center text-sm font-medium mt-2">
          {STEPS[currentIndex]?.label}
        </p>
      </div>
    </div>
  );
}
