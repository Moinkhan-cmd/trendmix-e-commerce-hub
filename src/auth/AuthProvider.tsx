import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  signUp,
  signIn,
  logOut,
  resetPassword,
  getUserProfile,
  updateUserProfile,
  isAdmin,
  getAuthErrorMessage,
} from "./auth-service";
import type { UserProfile } from "./types";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (data: Partial<Pick<UserProfile, "displayName" | "phone" | "address">>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) {
      setProfile(null);
      setIsAdminUser(false);
      return;
    }

    try {
      const userProfile = await getUserProfile(auth.currentUser.uid);
      setProfile(userProfile);
      
      const adminStatus = await isAdmin(auth.currentUser.uid);
      setIsAdminUser(adminStatus);
    } catch (err) {
      console.error("Failed to refresh profile:", err);
    }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setLoading(true);

      try {
        if (nextUser) {
          const userProfile = await getUserProfile(nextUser.uid);
          setProfile(userProfile);
          
          const adminStatus = await isAdmin(nextUser.uid);
          setIsAdminUser(adminStatus);
        } else {
          setProfile(null);
          setIsAdminUser(false);
        }
      } catch (err) {
        console.error("Auth state change error:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSignUp = useCallback(async (email: string, password: string, name: string) => {
    setError(null);
    setLoading(true);
    
    try {
      await signUp(email, password, name);
    } catch (err) {
      const message = getAuthErrorMessage(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSignIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    
    try {
      await signIn(email, password);
    } catch (err) {
      const message = getAuthErrorMessage(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setError(null);
    
    try {
      await logOut();
      // Immediately clear local state to ensure UI updates
      setUser(null);
      setProfile(null);
      setIsAdminUser(false);
    } catch (err) {
      const message = getAuthErrorMessage(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  const handleResetPassword = useCallback(async (email: string) => {
    setError(null);
    
    try {
      await resetPassword(email);
    } catch (err) {
      const message = getAuthErrorMessage(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  const handleUpdateProfile = useCallback(async (
    data: Partial<Pick<UserProfile, "displayName" | "phone" | "address">>
  ) => {
    if (!user) throw new Error("No user signed in");
    setError(null);
    
    try {
      await updateUserProfile(user.uid, data);
      await refreshProfile();
    } catch (err) {
      const message = getAuthErrorMessage(err);
      setError(message);
      throw new Error(message);
    }
  }, [user, refreshProfile]);

  const value = useMemo(
    () => ({
      user,
      profile,
      isAuthenticated: !!user,
      isAdmin: isAdminUser,
      loading,
      error,
      signUp: handleSignUp,
      signIn: handleSignIn,
      signOut: handleSignOut,
      resetPassword: handleResetPassword,
      updateProfile: handleUpdateProfile,
      refreshProfile,
      clearError,
    }),
    [
      user,
      profile,
      isAdminUser,
      loading,
      error,
      handleSignUp,
      handleSignIn,
      handleSignOut,
      handleResetPassword,
      handleUpdateProfile,
      refreshProfile,
      clearError,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
