/**
 * Password Validation Hook
 * 
 * Validates password against security requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */

import { useMemo } from "react";

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Hook to check if password meets all requirements
 */
export function usePasswordValidation(password: string): PasswordValidationResult {
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
