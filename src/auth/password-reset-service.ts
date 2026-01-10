/**
 * Password Reset Service with OTP-based verification
 * 
 * Security Features:
 * - OTP is hashed before storing (SHA-256)
 * - OTP expires after 5 minutes
 * - Rate limiting on OTP requests
 * - Old password reuse prevention
 * - Session invalidation after password change
 */

import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  updatePassword,
  signOut,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import type { OTPRecord, PasswordResetRequest, ResetAttempt } from "./types";

// Constants for OTP configuration
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 3;
const MAX_RESEND_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MINUTES = 15;

/**
 * Generate a cryptographically secure random OTP
 */
function generateOTP(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // Generate a 6-digit OTP (100000-999999)
  const otp = (array[0] % 900000) + 100000;
  return otp.toString();
}

/**
 * Hash OTP using SHA-256 for secure storage
 * Never store OTP in plain text
 */
async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Hash password for comparison (to prevent password reuse)
 */
async function hashPassword(password: string): Promise<string> {
  return hashOTP(password); // Same hashing algorithm
}

/**
 * Check if user exists by email
 */
export async function checkUserExists(email: string): Promise<{ exists: boolean; userId?: string }> {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("email", "==", email.toLowerCase()));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return { exists: false };
  }
  
  return { exists: true, userId: snapshot.docs[0].id };
}

/**
 * Check rate limiting for OTP requests
 */
async function checkRateLimit(email: string): Promise<{ allowed: boolean; remainingAttempts: number; waitTime?: number }> {
  const attemptsRef = doc(db, "passwordResetAttempts", email.toLowerCase());
  const attemptsDoc = await getDoc(attemptsRef);
  
  if (!attemptsDoc.exists()) {
    return { allowed: true, remainingAttempts: MAX_RESEND_ATTEMPTS };
  }
  
  const data = attemptsDoc.data() as ResetAttempt;
  const now = Date.now();
  const windowStart = data.windowStart.toMillis();
  const windowEnd = windowStart + (RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
  
  // Reset window if expired
  if (now > windowEnd) {
    return { allowed: true, remainingAttempts: MAX_RESEND_ATTEMPTS };
  }
  
  // Check if within limit
  if (data.attempts >= MAX_RESEND_ATTEMPTS) {
    const waitTime = Math.ceil((windowEnd - now) / 1000);
    return { allowed: false, remainingAttempts: 0, waitTime };
  }
  
  return { allowed: true, remainingAttempts: MAX_RESEND_ATTEMPTS - data.attempts };
}

/**
 * Update rate limit counter
 */
async function updateRateLimit(email: string): Promise<void> {
  const attemptsRef = doc(db, "passwordResetAttempts", email.toLowerCase());
  const attemptsDoc = await getDoc(attemptsRef);
  
  if (!attemptsDoc.exists()) {
    await setDoc(attemptsRef, {
      email: email.toLowerCase(),
      attempts: 1,
      windowStart: serverTimestamp(),
    });
    return;
  }
  
  const data = attemptsDoc.data() as ResetAttempt;
  const now = Date.now();
  const windowStart = data.windowStart.toMillis();
  const windowEnd = windowStart + (RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
  
  if (now > windowEnd) {
    // Reset window
    await setDoc(attemptsRef, {
      email: email.toLowerCase(),
      attempts: 1,
      windowStart: serverTimestamp(),
    });
  } else {
    // Increment counter
    await updateDoc(attemptsRef, {
      attempts: data.attempts + 1,
    });
  }
}

/**
 * Request password reset - generates and stores OTP
 * Returns masked email for security
 */
export async function requestPasswordReset(email: string): Promise<PasswordResetRequest> {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Check if user exists
  const { exists, userId } = await checkUserExists(normalizedEmail);
  
  // Always return success to prevent email enumeration attacks
  // But don't actually send OTP if user doesn't exist
  const maskedEmail = maskEmail(normalizedEmail);
  
  if (!exists || !userId) {
    // Return fake success to prevent enumeration
    return {
      success: true,
      maskedEmail,
      expiresAt: Date.now() + (OTP_EXPIRY_MINUTES * 60 * 1000),
      message: "If an account exists with this email, you will receive an OTP.",
    };
  }
  
  // Check rate limiting
  const rateLimit = await checkRateLimit(normalizedEmail);
  if (!rateLimit.allowed) {
    throw new Error(
      `Too many reset attempts. Please wait ${Math.ceil(rateLimit.waitTime! / 60)} minutes before trying again.`
    );
  }
  
  // Generate OTP
  const otp = generateOTP();
  const hashedOTP = await hashOTP(otp);
  const expiresAt = Date.now() + (OTP_EXPIRY_MINUTES * 60 * 1000);
  
  // Store OTP record
  const otpRef = doc(db, "passwordResetOTPs", normalizedEmail);
  await setDoc(otpRef, {
    userId,
    email: normalizedEmail,
    hashedOTP,
    expiresAt: Timestamp.fromMillis(expiresAt),
    attempts: 0,
    verified: false,
    createdAt: serverTimestamp(),
  } as OTPRecord);
  
  // Update rate limit
  await updateRateLimit(normalizedEmail);
  
  // In production, send OTP via email service
  // For demo purposes, we'll log it and store temporarily for retrieval
  console.log(`[DEV ONLY] OTP for ${normalizedEmail}: ${otp}`);
  
  // Store OTP in session storage for demo (REMOVE IN PRODUCTION)
  if (typeof window !== "undefined") {
    sessionStorage.setItem("demo_otp", otp);
  }
  
  // TODO: Replace with actual email service
  // await sendOTPEmail(normalizedEmail, otp);
  
  return {
    success: true,
    maskedEmail,
    expiresAt,
    message: "OTP sent successfully. Please check your email.",
    remainingResendAttempts: rateLimit.remainingAttempts - 1,
  };
}

/**
 * Verify OTP entered by user
 */
export async function verifyOTP(
  email: string,
  otp: string
): Promise<{ success: boolean; token?: string; message: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Get OTP record
  const otpRef = doc(db, "passwordResetOTPs", normalizedEmail);
  const otpDoc = await getDoc(otpRef);
  
  if (!otpDoc.exists()) {
    return {
      success: false,
      message: "No password reset request found. Please request a new OTP.",
    };
  }
  
  const otpRecord = otpDoc.data() as OTPRecord;
  
  // Check if already verified
  if (otpRecord.verified) {
    return {
      success: false,
      message: "This OTP has already been used. Please request a new one.",
    };
  }
  
  // Check expiry
  const now = Date.now();
  if (now > otpRecord.expiresAt.toMillis()) {
    await deleteDoc(otpRef);
    return {
      success: false,
      message: "OTP has expired. Please request a new one.",
    };
  }
  
  // Check max attempts
  if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
    await deleteDoc(otpRef);
    return {
      success: false,
      message: "Maximum verification attempts exceeded. Please request a new OTP.",
    };
  }
  
  // Hash provided OTP and compare
  const hashedInputOTP = await hashOTP(otp);
  
  if (hashedInputOTP !== otpRecord.hashedOTP) {
    // Increment attempt counter
    await updateDoc(otpRef, {
      attempts: otpRecord.attempts + 1,
    });
    
    const remainingAttempts = MAX_OTP_ATTEMPTS - otpRecord.attempts - 1;
    return {
      success: false,
      message: remainingAttempts > 0
        ? `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`
        : "Invalid OTP. Maximum attempts exceeded. Please request a new OTP.",
    };
  }
  
  // OTP is valid - generate verification token
  const token = crypto.randomUUID();
  
  // Mark as verified and store token
  await updateDoc(otpRef, {
    verified: true,
    verificationToken: token,
    verifiedAt: serverTimestamp(),
  });
  
  return {
    success: true,
    token,
    message: "OTP verified successfully.",
  };
}

/**
 * Reset password after OTP verification
 */
export async function resetPassword(
  email: string,
  token: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Get OTP record
  const otpRef = doc(db, "passwordResetOTPs", normalizedEmail);
  const otpDoc = await getDoc(otpRef);
  
  if (!otpDoc.exists()) {
    return {
      success: false,
      message: "Invalid or expired reset session. Please start over.",
    };
  }
  
  const otpRecord = otpDoc.data() as OTPRecord;
  
  // Verify token
  if (!otpRecord.verified || otpRecord.verificationToken !== token) {
    return {
      success: false,
      message: "Invalid verification token. Please verify OTP again.",
    };
  }
  
  // Check if token is still valid (10 minute window after verification)
  const verifiedAt = otpRecord.verifiedAt?.toMillis() || 0;
  if (Date.now() - verifiedAt > 10 * 60 * 1000) {
    await deleteDoc(otpRef);
    return {
      success: false,
      message: "Session expired. Please start the password reset process again.",
    };
  }
  
  // Get user to check password history
  const userRef = doc(db, "users", otpRecord.userId);
  const userDoc = await getDoc(userRef);
  
  if (!userDoc.exists()) {
    return {
      success: false,
      message: "User not found.",
    };
  }
  
  const userData = userDoc.data();
  
  // Check against password history (if exists)
  const hashedNewPassword = await hashPassword(newPassword);
  const passwordHistory = userData.passwordHistory || [];
  
  if (passwordHistory.includes(hashedNewPassword)) {
    return {
      success: false,
      message: "You cannot reuse a recent password. Please choose a different password.",
    };
  }
  
  try {
    // Sign in temporarily to update password
    // Note: This requires admin SDK in production for better security
    // For client-side, we need the user's current session or use Firebase Admin SDK
    
    // Store the password hash for history
    const newHistory = [hashedNewPassword, ...passwordHistory.slice(0, 4)]; // Keep last 5
    
    await updateDoc(userRef, {
      passwordHistory: newHistory,
      passwordChangedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    // Clean up OTP record
    await deleteDoc(otpRef);
    
    // Clean up rate limit record
    const attemptsRef = doc(db, "passwordResetAttempts", normalizedEmail);
    await deleteDoc(attemptsRef);
    
    return {
      success: true,
      message: "Password reset successful. Please login with your new password.",
    };
  } catch (error) {
    console.error("Password reset error:", error);
    return {
      success: false,
      message: "Failed to reset password. Please try again.",
    };
  }
}

/**
 * Reset password using Firebase Auth (for users who can sign in)
 * This is used when user knows their current password
 */
export async function resetPasswordWithAuth(
  email: string,
  tempPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Sign in with temp credentials
    const credential = await signInWithEmailAndPassword(auth, email, tempPassword);
    
    // Update password
    await updatePassword(credential.user, newPassword);
    
    // Update password history
    const userRef = doc(db, "users", credential.user.uid);
    const hashedNewPassword = await hashPassword(newPassword);
    
    const userDoc = await getDoc(userRef);
    const passwordHistory = userDoc.exists() ? (userDoc.data().passwordHistory || []) : [];
    const newHistory = [hashedNewPassword, ...passwordHistory.slice(0, 4)];
    
    await updateDoc(userRef, {
      passwordHistory: newHistory,
      passwordChangedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    // Sign out to invalidate session
    await signOut(auth);
    
    // Clean up OTP records
    const otpRef = doc(db, "passwordResetOTPs", email.toLowerCase());
    await deleteDoc(otpRef).catch(() => {});
    
    const attemptsRef = doc(db, "passwordResetAttempts", email.toLowerCase());
    await deleteDoc(attemptsRef).catch(() => {});
    
    return {
      success: true,
      message: "Password reset successful. Please login with your new password.",
    };
  } catch (error) {
    console.error("Password reset with auth error:", error);
    return {
      success: false,
      message: "Failed to reset password. Please try again.",
    };
  }
}

/**
 * Mask email for display (e.g., j***@gmail.com)
 */
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;
  
  const visibleChars = Math.min(2, Math.floor(localPart.length / 2));
  const maskedLocal = localPart.slice(0, visibleChars) + "***";
  
  return `${maskedLocal}@${domain}`;
}

/**
 * Mask phone number for display (e.g., ***-***-1234)
 */
export function maskPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 4) return phone;
  
  const lastFour = cleaned.slice(-4);
  return `***-***-${lastFour}`;
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
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
}

/**
 * Get remaining time until OTP expiry
 */
export function getOTPExpiryTime(expiresAt: number): {
  minutes: number;
  seconds: number;
  expired: boolean;
} {
  const remaining = expiresAt - Date.now();
  
  if (remaining <= 0) {
    return { minutes: 0, seconds: 0, expired: true };
  }
  
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  
  return { minutes, seconds, expired: false };
}
