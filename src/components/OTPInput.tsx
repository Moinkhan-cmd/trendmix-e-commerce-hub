/**
 * OTP Input Component
 * 
 * Features:
 * - 6 individual digit inputs
 * - Auto-focus to next input on entry
 * - Backspace navigation to previous input
 * - Paste support for full OTP
 * - Mobile-optimized with numeric keyboard
 * - Visual feedback for filled/empty states
 */

import { useRef, useState, useEffect, useCallback, type ClipboardEvent, type KeyboardEvent, type ChangeEvent } from "react";
import { cn } from "@/lib/utils";

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export function OTPInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
  className,
  autoFocus = true,
}: OTPInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Initialize refs array
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, length);
  }, [length]);

  // Auto-focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  // Focus next empty input when value changes
  useEffect(() => {
    if (value.length < length && inputRefs.current[value.length]) {
      inputRefs.current[value.length]?.focus();
    }
  }, [value.length, length]);

  // Call onComplete when all digits entered
  useEffect(() => {
    if (value.length === length && onComplete) {
      onComplete(value);
    }
  }, [value, length, onComplete]);

  const handleChange = useCallback(
    (index: number) => (e: ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      // Only allow single digit
      if (inputValue.length > 1) {
        // If pasting, handle in handlePaste
        return;
      }
      
      // Only allow numbers
      if (inputValue && !/^\d$/.test(inputValue)) {
        return;
      }

      // Build new value
      const newValue = value.split("");
      newValue[index] = inputValue;
      const joinedValue = newValue.join("").slice(0, length);
      onChange(joinedValue);

      // Move to next input if digit entered
      if (inputValue && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [value, onChange, length]
  );

  const handleKeyDown = useCallback(
    (index: number) => (e: KeyboardEvent<HTMLInputElement>) => {
      // Handle backspace
      if (e.key === "Backspace") {
        e.preventDefault();
        
        const newValue = value.split("");
        
        if (newValue[index]) {
          // Clear current input
          newValue[index] = "";
        } else if (index > 0) {
          // Move to previous input and clear it
          newValue[index - 1] = "";
          inputRefs.current[index - 1]?.focus();
        }
        
        onChange(newValue.join(""));
      }

      // Handle arrow keys
      if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault();
        inputRefs.current[index - 1]?.focus();
      }
      
      if (e.key === "ArrowRight" && index < length - 1) {
        e.preventDefault();
        inputRefs.current[index + 1]?.focus();
      }
    },
    [value, onChange, length]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      
      const pastedData = e.clipboardData.getData("text/plain").trim();
      
      // Only allow numeric paste
      const numericOnly = pastedData.replace(/\D/g, "").slice(0, length);
      
      if (numericOnly) {
        onChange(numericOnly);
        
        // Focus appropriate input after paste
        const nextIndex = Math.min(numericOnly.length, length - 1);
        inputRefs.current[nextIndex]?.focus();
      }
    },
    [onChange, length]
  );

  const handleFocus = useCallback((index: number) => () => {
    setFocusedIndex(index);
    
    // Select the content when focused
    inputRefs.current[index]?.select();
  }, []);

  const handleBlur = useCallback(() => {
    setFocusedIndex(null);
  }, []);

  return (
    <div
      className={cn(
        "flex justify-center gap-2 sm:gap-3",
        className
      )}
    >
      {Array.from({ length }, (_, index) => {
        const digit = value[index] || "";
        const isFocused = focusedIndex === index;
        const isFilled = !!digit;

        return (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={1}
            value={digit}
            onChange={handleChange(index)}
            onKeyDown={handleKeyDown(index)}
            onPaste={handlePaste}
            onFocus={handleFocus(index)}
            onBlur={handleBlur}
            disabled={disabled}
            autoComplete="one-time-code"
            className={cn(
              // Base styles
              "w-10 h-12 sm:w-12 sm:h-14",
              "text-center text-xl sm:text-2xl font-semibold",
              "rounded-lg border-2",
              "bg-background",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-offset-2",
              
              // States
              error && !isFocused && [
                "border-red-500",
                "ring-red-500/20",
                "bg-red-50 dark:bg-red-900/10",
              ],
              
              !error && !isFocused && !isFilled && [
                "border-input",
                "hover:border-primary/50",
              ],
              
              !error && !isFocused && isFilled && [
                "border-primary/50",
                "bg-primary/5",
              ],
              
              isFocused && !error && [
                "border-primary",
                "ring-primary/20",
                "shadow-lg shadow-primary/10",
              ],
              
              isFocused && error && [
                "border-red-500",
                "ring-red-500/20",
              ],
              
              disabled && [
                "opacity-50",
                "cursor-not-allowed",
                "bg-muted",
              ],
            )}
            aria-label={`Digit ${index + 1} of ${length}`}
          />
        );
      })}
    </div>
  );
}

/**
 * OTP Timer Component
 * Displays countdown for OTP expiry and resend cooldown
 */
interface OTPTimerProps {
  expiresAt: number;
  onExpire?: () => void;
  className?: string;
}

export function OTPTimer({ expiresAt, onExpire, className }: OTPTimerProps) {
  const [timeLeft, setTimeLeft] = useState(() => {
    const remaining = expiresAt - Date.now();
    return Math.max(0, Math.floor(remaining / 1000));
  });

  useEffect(() => {
    if (timeLeft <= 0) {
      onExpire?.();
      return;
    }

    const timer = setInterval(() => {
      const remaining = expiresAt - Date.now();
      const newTimeLeft = Math.max(0, Math.floor(remaining / 1000));
      
      setTimeLeft(newTimeLeft);
      
      if (newTimeLeft <= 0) {
        clearInterval(timer);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, onExpire, timeLeft]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const isLow = timeLeft <= 60;
  const isCritical = timeLeft <= 30;

  return (
    <div
      className={cn(
        "text-sm font-mono tabular-nums",
        isCritical && "text-red-500 animate-pulse",
        isLow && !isCritical && "text-orange-500",
        !isLow && "text-muted-foreground",
        className
      )}
    >
      <span>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </span>
    </div>
  );
}

export default OTPInput;
