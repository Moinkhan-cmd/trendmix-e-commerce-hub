import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  browserSessionPersistence,
  setPersistence,
  type User,
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
  const code = (error as AuthError)?.code || "";
  
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
    "auth/popup-closed-by-user": "Sign in was cancelled. Please try again.",
    "auth/requires-recent-login": "Please sign out and sign back in to perform this action.",
  };

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

// Sign up new user
export async function signUp(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  // Use session persistence so the user is logged out when the browser is closed
  await setPersistence(auth, browserSessionPersistence);
  
  // Create Firebase Auth user
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const user = credential.user;

  // Update display name
  await updateProfile(user, { displayName });

  // Create Firestore profile
  await createUserProfile(user, displayName);

  // Send verification email
  await sendEmailVerification(user).catch(console.error);

  return user;
}

// Sign in existing user
export async function signIn(email: string, password: string): Promise<User> {
  // Use session persistence so the user is logged out when the browser is closed
  await setPersistence(auth, browserSessionPersistence);
  
  const credential = await signInWithEmailAndPassword(auth, email, password);
  
  // Update last login
  await updateLastLogin(credential.user.uid);
  
  return credential.user;
}

// Sign out
export async function logOut(): Promise<void> {
  // Clear the Firebase auth state
  await signOut(auth);
  
  // Force clear any cached auth state by reloading if needed
  // The onAuthStateChanged listener will handle the state update
}

// Send password reset email
export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
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
  
  await updateDoc(userRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });

  // Update Firebase Auth display name if changed
  if (data.displayName && auth.currentUser) {
    await updateProfile(auth.currentUser, { displayName: data.displayName });
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
  const user = auth.currentUser;
  if (!user) throw new Error("No user signed in");
  await sendEmailVerification(user);
}
