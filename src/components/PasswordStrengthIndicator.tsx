/**
 * Password Strength Indicator Component
 * 
 * Displays visual feedback for password strength with:
 * - Color-coded strength bars
 * - Strength label
 * - Validation requirements checklist
 */

import { useMemo } from "react";
import { Check, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
  className?: string;
}

interface PasswordRequirement {
  label: string;
  validator: (password: string) => boolean;
}

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { label: "At least 8 characters", validator: (p) => p.length >= 8 },
  { label: "One uppercase letter", validator: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", validator: (p) => /[a-z]/.test(p) },
  { label: "One number", validator: (p) => /\d/.test(p) },
];

type StrengthLevel = {
  score: number;
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
};

const STRENGTH_LEVELS: StrengthLevel[] = [
  { score: 0, label: "Very Weak", color: "bg-red-500", bgColor: "bg-red-100 dark:bg-red-900/30", textColor: "text-red-600 dark:text-red-400" },
  { score: 1, label: "Weak", color: "bg-orange-500", bgColor: "bg-orange-100 dark:bg-orange-900/30", textColor: "text-orange-600 dark:text-orange-400" },
  { score: 2, label: "Fair", color: "bg-yellow-500", bgColor: "bg-yellow-100 dark:bg-yellow-900/30", textColor: "text-yellow-600 dark:text-yellow-400" },
  { score: 3, label: "Strong", color: "bg-green-500", bgColor: "bg-green-100 dark:bg-green-900/30", textColor: "text-green-600 dark:text-green-400" },
  { score: 4, label: "Very Strong", color: "bg-emerald-500", bgColor: "bg-emerald-100 dark:bg-emerald-900/30", textColor: "text-emerald-600 dark:text-emerald-400" },
];

export function PasswordStrengthIndicator({
  password,
  showRequirements = true,
  className,
}: PasswordStrengthIndicatorProps) {
  const analysis = useMemo(() => {
    if (!password) {
      return {
        score: 0,
        metRequirements: [],
        allMet: false,
      };
    }

    // Check each requirement
    const metRequirements = PASSWORD_REQUIREMENTS.map((req) => ({
      ...req,
      met: req.validator(password),
    }));

    const metCount = metRequirements.filter((r) => r.met).length;
    
    // Calculate score based on requirements met plus bonus for length and special chars
    let score = metCount;
    
    // Bonus for extra length
    if (password.length >= 12) score += 0.5;
    if (password.length >= 16) score += 0.5;
    
    // Bonus for special characters
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 0.5;
    
    // Normalize to 0-4
    score = Math.min(4, Math.floor(score));
    
    // Can't be strong if not all requirements met
    if (metCount < PASSWORD_REQUIREMENTS.length) {
      score = Math.min(score, 2);
    }

    return {
      score,
      metRequirements,
      allMet: metCount === PASSWORD_REQUIREMENTS.length,
    };
  }, [password]);

  const strength = STRENGTH_LEVELS[analysis.score];

  if (!password) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Strength Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Password strength</span>
          <span className={cn("text-xs font-medium", strength.textColor)}>
            {strength.label}
          </span>
        </div>
        
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map((index) => (
            <div
              key={index}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-300",
                index <= analysis.score
                  ? strength.color
                  : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      {/* Requirements Checklist */}
      {showRequirements && (
        <div className={cn(
          "rounded-lg p-3 transition-colors duration-300",
          analysis.allMet ? strength.bgColor : "bg-muted/50"
        )}>
          <div className="flex items-center gap-2 mb-2">
            {analysis.allMet ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-xs font-medium">
              {analysis.allMet ? "All requirements met" : "Password requirements"}
            </span>
          </div>
          
          <ul className="space-y-1.5">
            {analysis.metRequirements.map((req, index) => (
              <li
                key={index}
                className={cn(
                  "flex items-center gap-2 text-xs transition-all duration-200",
                  req.met
                    ? "text-green-600 dark:text-green-400"
                    : "text-muted-foreground"
                )}
              >
                {req.met ? (
                  <Check className="h-3 w-3 shrink-0" />
                ) : (
                  <X className="h-3 w-3 shrink-0" />
                )}
                <span className={cn(req.met && "line-through opacity-70")}>
                  {req.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Hook to check if password meets all requirements
 */
export function usePasswordValidation(password: string) {
  return useMemo(() => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }
    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }
    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }
    if (!/\d/.test(password)) {
      errors.push("Password must contain at least one number");
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [password]);
}

export default PasswordStrengthIndicator;
