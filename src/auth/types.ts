import type { Timestamp } from "firebase/firestore";

export type UserRole = "user" | "admin";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
  emailVerified: boolean;
  disabled: boolean;
}

export interface SignUpData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthError {
  code: string;
  message: string;
}

export interface PasswordStrength {
  score: number; // 0-4
  label: "Very Weak" | "Weak" | "Fair" | "Strong" | "Very Strong";
  suggestions: string[];
  isValid: boolean;
}

/**
 * OTP Record stored in Firestore
 * OTP is hashed for security - never stored in plain text
 */
export interface OTPRecord {
  userId: string;
  email: string;
  hashedOTP: string;
  expiresAt: import("firebase/firestore").Timestamp;
  attempts: number;
  verified: boolean;
  verificationToken?: string;
  verifiedAt?: import("firebase/firestore").Timestamp;
  createdAt: import("firebase/firestore").Timestamp;
}

/**
 * Rate limiting record for password reset attempts
 */
export interface ResetAttempt {
  email: string;
  attempts: number;
  windowStart: import("firebase/firestore").Timestamp;
}

/**
 * Response from password reset request
 */
export interface PasswordResetRequest {
  success: boolean;
  maskedEmail: string;
  expiresAt: number;
  message: string;
  remainingResendAttempts?: number;
  /** OTP included for demo purposes only - REMOVE IN PRODUCTION */
  demoOtp?: string;
}

/**
 * Password reset step states
 */
export type PasswordResetStep = "email" | "otp" | "newPassword" | "success";

/**
 * OTP verification result
 */
export interface OTPVerificationResult {
  success: boolean;
  token?: string;
  message: string;
}

/**
 * Password reset result
 */
export interface PasswordResetResult {
  success: boolean;
  message: string;
}
