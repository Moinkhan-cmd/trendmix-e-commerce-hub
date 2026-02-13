import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isUidAdmin } from "@/admin/services/admin";

type AdminAuthState = {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  refreshAdminCheck: () => Promise<void>;
  signOutAdmin: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthState | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const authInitSettledRef = useRef(false);

  const refreshAdminCheck = async () => {
    if (!auth.currentUser) {
      setIsAdmin(false);
      return;
    }

    setLoading(true);
    try {
      const ok = await isUidAdmin(auth.currentUser.uid);
      setIsAdmin(ok);
    } finally {
      setLoading(false);
    }
  };

  const signOutAdmin = async () => {
    await signOut(auth);
    setIsAdmin(false);
  };

  useEffect(() => {
    const loadingTimeout = window.setTimeout(() => {
      if (authInitSettledRef.current) return;
      authInitSettledRef.current = true;
      setLoading(false);
    }, 8000);

    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setLoading(true);

      try {
        if (!nextUser) {
          setIsAdmin(false);
          return;
        }

        const ok = await isUidAdmin(nextUser.uid);
        setIsAdmin(ok);
      } catch {
        setIsAdmin(false);
      } finally {
        authInitSettledRef.current = true;
        window.clearTimeout(loadingTimeout);
        setLoading(false);
      }
    });

    return () => {
      window.clearTimeout(loadingTimeout);
      unsub();
    };
  }, []);

  const value = useMemo(
    () => ({ user, isAdmin, loading, refreshAdminCheck, signOutAdmin }),
    [user, isAdmin, loading]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  return ctx;
}
