import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrderDoc, ProductDoc, UserDoc } from "@/lib/models";

type WithId<T> = T & { id: string };

export default function AdminDashboard() {
  const [products, setProducts] = useState<Array<WithId<ProductDoc>>>([]);
  const [orders, setOrders] = useState<Array<WithId<OrderDoc>>>([]);
  const [users, setUsers] = useState<Array<WithId<UserDoc>>>([]);

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, "products"), (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProductDoc) })));
    });
    const unsubOrders = onSnapshot(collection(db, "orders"), (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDoc) })));
    });
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as UserDoc) })));
    });

    return () => {
      unsubProducts();
      unsubOrders();
      unsubUsers();
    };
  }, []);

  const revenue = useMemo(() => {
    return orders
      .filter((o) => o.status !== "Cancelled")
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [orders]);

  const publishedCount = useMemo(
    () => products.filter((p) => p.published).length,
    [products]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of products, orders, users, and revenue.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{products.length}</div>
            <div className="text-xs text-muted-foreground">Published: {publishedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{orders.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{users.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Revenue (non-cancelled)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">₹{revenue.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Counts and revenue update in realtime via Firestore snapshots.
        </CardContent>
      </Card>
    </div>
  );
}
