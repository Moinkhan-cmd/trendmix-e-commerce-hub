import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { auth } from "@/lib/firebase";

const Account = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const signOutNow = async () => {
    await signOut(auth);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 container py-8">
        <h1 className="text-3xl font-bold">Account</h1>
        <p className="text-muted-foreground mt-1">
          This project uses Firebase auth. If you’re signed in (admin or future customer auth), it shows here.
        </p>

        <Separator className="my-6" />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <p className="text-muted-foreground">Loading…</p>
              ) : user ? (
                <>
                  <div className="text-sm">
                    <div>
                      <span className="text-muted-foreground">Email:</span> {user.email ?? "(no email)"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">UID:</span> {user.uid}
                    </div>
                  </div>
                  <Button variant="outline" onClick={signOutNow}>
                    Sign out
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground">You’re not signed in.</p>
                  <Button asChild>
                    <Link to="/admin/login">Go to Admin login</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Orders</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Order history is a demo placeholder. If you want, I can wire storefront checkout + order creation next.
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Account;
