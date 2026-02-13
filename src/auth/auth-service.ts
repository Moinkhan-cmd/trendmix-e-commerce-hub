import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  browserSessionPersistence,
  setPersistence,
  reload,
  GoogleAuthProvider,
  type User,
  type ActionCodeSettings,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { UserProfile, UserRole, PasswordStrength, AuthError } from "./types";

let pendingVerificationUser: User | null = null;
const VERIFICATION_RESEND_COOLDOWN_MS = 30_000;
let lastVerificationEmailSentAt = 0;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 10 * 60 * 1000;

type LoginAttemptState = {
  attempts: number;
  lockUntil: number;
};

function normalizeText(value: string, maxLength = 120): string {
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeEmail(email: string): string {
  return normalizeText(email, 254).toLowerCase();
}

function sanitizeDisplayName(name: string): string {
  return normalizeText(name, 80);
}

function sanitizeOptionalText(value: string | undefined, maxLength = 120): string | undefined {
  if (!value) return undefined;
  const normalized = normalizeText(value, maxLength);
  return normalized || undefined;
}

function getLoginAttemptStorageKey(email: string): string {
  return `trendmix_login_attempts_${sanitizeEmail(email)}`;
}

function getLoginAttemptState(email: string): LoginAttemptState {
  if (typeof window === "undefined") return { attempts: 0, lockUntil: 0 };

  const key = getLoginAttemptStorageKey(email);
  const raw = localStorage.getItem(key);
  if (!raw) return { attempts: 0, lockUntil: 0 };

  try {
    const parsed = JSON.parse(raw) as LoginAttemptState;
    return {
      attempts: Number(parsed.attempts ?? 0),
      lockUntil: Number(parsed.lockUntil ?? 0),
    };
  } catch {
    localStorage.removeItem(key);
    return { attempts: 0, lockUntil: 0 };
  }
}

function setLoginAttemptState(email: string, state: LoginAttemptState): void {
  if (typeof window === "undefined") return;
  const key = getLoginAttemptStorageKey(email);
  localStorage.setItem(key, JSON.stringify(state));
}

function clearLoginAttemptState(email: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(getLoginAttemptStorageKey(email));
}

function enforceLoginLockout(email: string): void {
  const state = getLoginAttemptState(email);
  const now = Date.now();
  if (state.lockUntil > now) {
    const waitSeconds = Math.ceil((state.lockUntil - now) / 1000);
    const err = new Error(`Too many failed attempts. Please wait ${waitSeconds} seconds and try again.`) as Error & { code: string };
    err.code = "auth/too-many-requests";
    throw err;
  }
}

function recordLoginFailure(email: string): void {
  const now = Date.now();
  const state = getLoginAttemptState(email);
  const nextAttempts = state.lockUntil > now ? state.attempts : state.attempts + 1;

  if (nextAttempts >= LOGIN_MAX_ATTEMPTS) {
    setLoginAttemptState(email, {
      attempts: nextAttempts,
      lockUntil: now + LOGIN_LOCKOUT_MS,
    });
    return;
  }

  setLoginAttemptState(email, {
    attempts: nextAttempts,
    lockUntil: 0,
  });
}

const getVerificationActionCodeSettings = (): ActionCodeSettings | undefined => {
  if (typeof window === "undefined") return undefined;

  return {
    url: `${window.location.origin}/login`,
    handleCodeInApp: false,
  };
};

const getPasswordResetActionCodeSettings = (): ActionCodeSettings | undefined => {
  if (typeof window === "undefined") return undefined;

  const isLocalhost =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const origin = isLocalhost
    ? window.location.origin
    : window.location.origin.replace(/^http:/, "https:");

  return {
    url: `${origin}/login?passwordReset=sent`,
    handleCodeInApp: false,
  };
};

export class EmailNotVerifiedError extends Error {
  code = "auth/email-not-verified";
  user: User;

  constructor(user: User) {
    super("Please verify your email before logging in.");
    this.name = "EmailNotVerifiedError";
    this.user = user;
  }
}

export function isEmailNotVerifiedError(error: unknown): error is EmailNotVerifiedError {
  return error instanceof EmailNotVerifiedError;
}

// Password strength checker
export function checkPasswordStrength(password: string): PasswordStrength {
  const suggestions: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else suggestions.push("Use at least 8 characters");

  if (password.length >= 12) score++;
  
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  else suggestions.push("Include both uppercase and lowercase letters");

  if (/\d/.test(password)) score++;
  else suggestions.push("Include at least one number");

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  else suggestions.push("Include at least one special character (!@#$%^&*)");

  // Penalize common patterns
  if (/^[a-zA-Z]+$/.test(password) || /^\d+$/.test(password)) {
    score = Math.max(0, score - 1);
    suggestions.push("Avoid using only letters or only numbers");
  }

  const labels: PasswordStrength["label"][] = [
    "Very Weak",
    "Weak", 
    "Fair",
    "Strong",
    "Very Strong",
  ];

  return {
    score: Math.min(score, 4),
    label: labels[Math.min(score, 4)],
    suggestions,
    isValid: score >= 2 && password.length >= 8,
  };
}

// Friendly error messages
export function getAuthErrorMessage(error: unknown): string {
  if (isEmailNotVerifiedError(error)) {
    return "Please verify your email before logging in.";
  }

  const maybeMessage = (error as { message?: string })?.message || "";
  const directCode = (error as AuthError)?.code || "";
  const messageCodeMatch = maybeMessage.match(/(auth\/[a-z0-9-]+)/i);
  const code = (directCode || messageCodeMatch?.[1] || "").toLowerCase();
  
  const errorMessages: Record<string, string> = {
    "auth/email-already-in-use": "An account with this email already exists. Please login instead.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/operation-not-allowed": "Email/password sign up is not enabled. Please contact support.",
    "auth/weak-password": "Password is too weak. Please use a stronger password.",
    "auth/user-disabled": "This account has been disabled. Please contact support.",
    "auth/user-not-found": "No account found with this email. Please check your email or sign up.",
    "auth/wrong-password": "Incorrect password. Please try again or reset your password.",
    "auth/invalid-credential": "Invalid email or password. Please check your credentials.",
    "auth/too-many-requests": "Too many failed attempts. Please wait a few minutes and try again.",
    "auth/network-request-failed": "Network error. Please check your internet connection.",
    "auth/popup-blocked": "Popup was blocked by your browser. Please allow popups and try again.",
    "auth/popup-blocked-by-browser": "Popup was blocked by your browser. Please allow popups and try again.",
    "auth/account-exists-with-different-credential": "An account already exists with this email using a different sign-in method.",
    "auth/unauthorized-domain": "This domain is not authorized for Google sign-in in Firebase Auth settings.",
    "auth/missing-email": "Please enter a valid email address.",
    "auth/popup-closed-by-user": "Sign in was cancelled. Please try again.",
    "auth/popup-blocked": "Popup was blocked by your browser. Please allow popups and try again.",
    "auth/cancelled-popup-request": "Sign in was cancelled. Please try again.",
    "auth/account-exists-with-different-credential": "An account already exists with a different sign-in method for this email.",
    "auth/requires-recent-login": "Please sign out and sign back in to perform this action.",
    "auth/no-pending-verification-user": "Please try logging in again before resending verification email.",
    "auth/already-verified": "Your email is already verified. Please log in.",
    "auth/invalid-continue-uri": "Password reset link configuration is invalid. Please contact support.",
    "auth/unauthorized-continue-uri": "Password reset domain is not authorized. Please contact support.",
    "auth/missing-continue-uri": "Password reset link configuration is missing. Please contact support.",
  };

  if (maybeMessage === "No user signed in") {
    return "Please try logging in again before resending verification email.";
  }

  if (maybeMessage === "Your email is already verified.") {
    return "Your email is already verified. Please log in.";
  }

  if (code === "auth/verification-resend-throttled" && maybeMessage) {
    return maybeMessage;
  }

  return errorMessages[code] || "An unexpected error occurred. Please try again.";
}

// Create user profile in Firestore
async function createUserProfile(user: User, displayName: string): Promise<void> {
  const userRef = doc(db, "users", user.uid);
  
  const profile: Omit<UserProfile, "createdAt" | "updatedAt"> = {
    uid: user.uid,
    email: user.email!,
    displayName,
    role: "user",
    emailVerified: user.emailVerified,
    disabled: false,
  };

  await setDoc(userRef, {
    ...profile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// Get user profile from Firestore
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

// Update last login timestamp
async function updateLastLogin(uid: string): Promise<void> {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    lastLoginAt: serverTimestamp(),
  }).catch(() => {
    // Profile might not exist yet for legacy users
  });
}

async function syncEmailVerificationStatus(uid: string, emailVerified: boolean): Promise<void> {
  const userRef = doc(db, "users", uid);

  await updateDoc(userRef, {
    emailVerified,
    updatedAt: serverTimestamp(),
  }).catch(() => {
    // Profile might not exist yet for legacy users
  });
}

async function ensureOAuthUserProfile(user: User): Promise<void> {
  const userRef = doc(db, "users", user.uid);
  const existingProfile = await getDoc(userRef);

  if (!existingProfile.exists()) {
    const profile: Omit<UserProfile, "createdAt" | "updatedAt"> = {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "User",
      photoURL: user.photoURL || undefined,
      role: "user",
      emailVerified: user.emailVerified,
      disabled: false,
    };

    await setDoc(userRef, {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
    return;
  }

  await updateDoc(userRef, {
    displayName: user.displayName || (existingProfile.data()?.displayName as string) || "User",
    photoURL: user.photoURL || existingProfile.data()?.photoURL || null,
    emailVerified: user.emailVerified,
    lastLoginAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).catch(() => {
    // non-fatal for legacy profiles
  });
}

// Sign up new user
export async function signUp(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const safeEmail = sanitizeEmail(email);
  const safeDisplayName = sanitizeDisplayName(displayName);

  // Use session persistence so the user is logged out when the browser is closed
  await setPersistence(auth, browserSessionPersistence);
  
  // Create Firebase Auth user
  const credential = await createUserWithEmailAndPassword(auth, safeEmail, password);
  const user = credential.user;

  // Update display name
  await updateProfile(user, { displayName: safeDisplayName });

  // Create Firestore profile
  await createUserProfile(user, safeDisplayName);

  // Send verification email
  await sendEmailVerification(user, getVerificationActionCodeSettings());

  return user;
}

// Sign in existing user
export async function signIn(email: string, password: string): Promise<User> {
  const safeEmail = sanitizeEmail(email);
  enforceLoginLockout(safeEmail);

  // Use session persistence so the user is logged out when the browser is closed
  await setPersistence(auth, browserSessionPersistence);

  let credential;
  try {
    credential = await signInWithEmailAndPassword(auth, safeEmail, password);
  } catch (error) {
    recordLoginFailure(safeEmail);
    throw error;
  }

  await reload(credential.user);

  if (!credential.user.emailVerified) {
    pendingVerificationUser = credential.user;
    throw new EmailNotVerifiedError(credential.user);
  }

  pendingVerificationUser = null;

  await syncEmailVerificationStatus(credential.user.uid, true);
  
  // Update last login
  await updateLastLogin(credential.user.uid);
  clearLoginAttemptState(safeEmail);
  
  return credential.user;
}

export async function signInWithGoogle(): Promise<User> {
  await setPersistence(auth, browserSessionPersistence);

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  const credential = await signInWithPopup(auth, provider);
  const user = credential.user;

  pendingVerificationUser = null;
  await ensureOAuthUserProfile(user);
  await syncEmailVerificationStatus(user.uid, user.emailVerified);
  await updateLastLogin(user.uid);

  return user;
}

// Sign out
export async function logOut(): Promise<void> {
  pendingVerificationUser = null;

  // Clear the Firebase auth state
  await signOut(auth);
  
  // Force clear any cached auth state by reloading if needed
  // The onAuthStateChanged listener will handle the state update
}

// Send password reset email
export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase(), getPasswordResetActionCodeSettings());
  } catch (error) {
    const code = ((error as AuthError)?.code || "").toLowerCase();

    // Do not leak whether an account exists for this email.
    if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
      return;
    }

    throw error;
  }
}

// Change password (requires recent auth)
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error("No user signed in");

  // Re-authenticate
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);

  // Update password
  await updatePassword(user, newPassword);
}

// Update user profile
export async function updateUserProfile(
  uid: string,
  data: Partial<Pick<UserProfile, "displayName" | "phone" | "address">>
): Promise<void> {
  const userRef = doc(db, "users", uid);

  const sanitizedData = {
    ...data,
    displayName: data.displayName ? sanitizeDisplayName(data.displayName) : undefined,
    phone: sanitizeOptionalText(data.phone, 30),
    address: data.address
      ? {
          street: sanitizeOptionalText(data.address.street, 180) || "",
          city: sanitizeOptionalText(data.address.city, 80) || "",
          state: sanitizeOptionalText(data.address.state, 80) || "",
          pincode: sanitizeOptionalText(data.address.pincode, 12) || "",
          country: sanitizeOptionalText(data.address.country, 80) || "India",
        }
      : undefined,
  };
  
  await updateDoc(userRef, {
    ...sanitizedData,
    updatedAt: serverTimestamp(),
  });

  // Update Firebase Auth display name if changed
  if (sanitizedData.displayName && auth.currentUser) {
    await updateProfile(auth.currentUser, { displayName: sanitizedData.displayName });
  }
}

// Check if user has specific role
export async function hasRole(uid: string, role: UserRole): Promise<boolean> {
  const profile = await getUserProfile(uid);
  return profile?.role === role;
}

// Check if user is admin
export async function isAdmin(uid: string): Promise<boolean> {
  return hasRole(uid, "admin");
}

// Resend verification email
export async function resendVerificationEmail(): Promise<void> {
  const now = Date.now();
  const remainingMs = VERIFICATION_RESEND_COOLDOWN_MS - (now - lastVerificationEmailSentAt);
  if (remainingMs > 0) {
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const err = new Error(`Please wait ${remainingSeconds} seconds before requesting another verification email.`) as Error & { code: string };
    err.code = "auth/verification-resend-throttled";
    throw err;
  }

  const user = auth.currentUser ?? pendingVerificationUser;
  if (!user) {
    const err = new Error("Please try logging in again before resending verification email.") as Error & { code: string };
    err.code = "auth/no-pending-verification-user";
    throw err;
  }

  await reload(user).catch(() => {
    // non-fatal
  });

  if (user.emailVerified) {
    pendingVerificationUser = null;
    const err = new Error("Your email is already verified.") as Error & { code: string };
    err.code = "auth/already-verified";
    throw err;
  }

  await sendEmailVerification(user, getVerificationActionCodeSettings());
  pendingVerificationUser = user;
  lastVerificationEmailSentAt = Date.now();
}

export async function refreshCurrentUser(): Promise<User | null> {
  const user = auth.currentUser;
  if (!user) return null;

  await reload(user);
  await syncEmailVerificationStatus(user.uid, user.emailVerified);
  return user;
}
