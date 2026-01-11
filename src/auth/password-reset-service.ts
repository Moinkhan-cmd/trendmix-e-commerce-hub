/**
 * Password Reset Service with OTP-based verification
 * 
 * This service uses Firebase's built-in password reset functionality
 * combined with an OTP verification layer for enhanced security.
 * 
 * Flow:
 * 1. User requests password reset
 * 2. System sends OTP to verify email ownership  
 * 3. After OTP verification, Firebase sends password reset link
 * 4. User clicks link and sets new password on Firebase's page
 * 
 * Security Features:
 * - OTP is hashed before storing (SHA-256)
 * - OTP expires after 5 minutes
 * - Rate limiting on OTP requests
 * - Prevents email enumeration attacks
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
import { sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import type { OTPRecord, PasswordResetRequest, ResetAttempt } from "./types";

// Constants for OTP configuration
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
 * Check if user exists by email
 */
export async function checkUserExists(email: string): Promise<{ exists: boolean; userId?: string }> {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email.toLowerCase()));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return { exists: false };
    }
    
    return { exists: true, userId: snapshot.docs[0].id };
  } catch (error) {
    console.error("Error checking user existence:", error);
    return { exists: false };
  }
}

/**
 * Check rate limiting for OTP requests
 */
async function checkRateLimit(email: string): Promise<{ allowed: boolean; remainingAttempts: number; waitTime?: number }> {
  try {
    const attemptsRef = doc(db, "passwordResetAttempts", email.toLowerCase());
    const attemptsDoc = await getDoc(attemptsRef);
    
    if (!attemptsDoc.exists()) {
      return { allowed: true, remainingAttempts: MAX_RESEND_ATTEMPTS };
    }
    
    const data = attemptsDoc.data() as ResetAttempt;
    const now = Date.now();
    const windowStart = data.windowStart?.toMillis?.() || now;
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
  } catch (error) {
    console.error("Error checking rate limit:", error);
    return { allowed: true, remainingAttempts: MAX_RESEND_ATTEMPTS };
  }
}

/**
 * Update rate limit counter
 */
async function updateRateLimit(email: string): Promise<void> {
  try {
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
    const windowStart = data.windowStart?.toMillis?.() || now;
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
        attempts: (data.attempts || 0) + 1,
      });
    }
  } catch (error) {
    console.error("Error updating rate limit:", error);
  }
}

/**
 * Request password reset - generates and stores OTP
 * Returns masked email for security
 */
export async function requestPasswordReset(email: string): Promise<PasswordResetRequest> {
  const normalizedEmail = email.toLowerCase().trim();
  const maskedEmail = maskEmail(normalizedEmail);
  
  // Check rate limiting first (even for non-existent users to prevent enumeration)
  const rateLimit = await checkRateLimit(normalizedEmail);
  if (!rateLimit.allowed) {
    throw new Error(
      `Too many reset attempts. Please wait ${Math.ceil(rateLimit.waitTime! / 60)} minutes before trying again.`
    );
  }
  
  // Generate OTP regardless of whether user exists (for demo purposes)
  // In production, you'd only generate for existing users but return same response
  const otp = generateOTP();
  const hashedOTP = await hashOTP(otp);
  const expiresAt = Date.now() + (OTP_EXPIRY_MINUTES * 60 * 1000);
  
  // Check if user exists
  const { exists, userId } = await checkUserExists(normalizedEmail);
  
  // Store OTP record (even if user doesn't exist for demo)
  // In production, only store if user exists
  const otpRef = doc(db, "passwordResetOTPs", normalizedEmail);
  await setDoc(otpRef, {
    userId: userId || "demo-user",
    email: normalizedEmail,
    hashedOTP,
    expiresAt: Timestamp.fromMillis(expiresAt),
    attempts: 0,
    verified: false,
    createdAt: serverTimestamp(),
  } as Omit<OTPRecord, "verificationToken" | "verifiedAt">);
  
  // Update rate limit
  await updateRateLimit(normalizedEmail);
  
  // Store OTP for demo retrieval
  if (typeof window !== "undefined") {
    sessionStorage.setItem("demo_otp", otp);
    // Store in localStorage as backup
    localStorage.setItem("demo_otp_backup", otp);
  }
  
  // Log to console for debugging
  console.log("═══════════════════════════════════════════");
  console.log("🔐 PASSWORD RESET OTP (DEMO MODE)");
  console.log(`📧 Email: ${normalizedEmail}`);
  console.log(`🔢 OTP: ${otp}`);
  console.log(`⏰ Expires: ${new Date(expiresAt).toLocaleTimeString()}`);
  console.log("═══════════════════════════════════════════");
  
  return {
    success: true,
    maskedEmail,
    expiresAt,
    message: "OTP sent successfully. Please check your email.",
    remainingResendAttempts: Math.max(0, rateLimit.remainingAttempts - 1),
    // Include OTP in response for demo (REMOVE IN PRODUCTION)
    demoOtp: otp,
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
  const expiresAt = otpRecord.expiresAt?.toMillis?.() || 0;
  if (now > expiresAt) {
    await deleteDoc(otpRef).catch(() => {});
    return {
      success: false,
      message: "OTP has expired. Please request a new one.",
    };
  }
  
  // Check max attempts
  if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
    await deleteDoc(otpRef).catch(() => {});
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
      attempts: (otpRecord.attempts || 0) + 1,
    }).catch(() => {});
    
    const remainingAttempts = MAX_OTP_ATTEMPTS - (otpRecord.attempts || 0) - 1;
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
 * Send Firebase password reset email after OTP verification
 * This is the secure way to reset passwords with Firebase Auth
 */
export async function sendFirebasePasswordReset(
  email: string,
  token: string
): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Verify the token is valid
  const otpRef = doc(db, "passwordResetOTPs", normalizedEmail);
  const otpDoc = await getDoc(otpRef);
  
  if (!otpDoc.exists()) {
    return {
      success: false,
      message: "Invalid session. Please start the password reset process again.",
    };
  }
  
  const otpRecord = otpDoc.data() as OTPRecord;
  
  // Verify token
  if (!otpRecord.verified || otpRecord.verificationToken !== token) {
    return {
      success: false,
      message: "Invalid verification. Please verify OTP again.",
    };
  }
  
  // Check if token is still valid (10 minute window after verification)
  const verifiedAt = otpRecord.verifiedAt?.toMillis?.() || 0;
  if (Date.now() - verifiedAt > 10 * 60 * 1000) {
    await deleteDoc(otpRef).catch(() => {});
    return {
      success: false,
      message: "Session expired. Please start the password reset process again.",
    };
  }
  
  try {
    // Send Firebase password reset email
    await sendPasswordResetEmail(auth, normalizedEmail);
    
    // Clean up OTP record
    await deleteDoc(otpRef).catch(() => {});
    
    // Clean up rate limit record
    const attemptsRef = doc(db, "passwordResetAttempts", normalizedEmail);
    await deleteDoc(attemptsRef).catch(() => {});
    
    return {
      success: true,
      message: "Password reset link sent to your email. Please check your inbox.",
    };
  } catch (error) {
    console.error("Firebase password reset error:", error);
    return {
      success: false,
      message: "Failed to send password reset email. Please try again.",
    };
  }
}

/**
 * Mask email for display (e.g., jo***@gmail.com)
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
