import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { OrderDoc, OrderStatus } from "@/lib/models";
import { toast } from "@/components/ui/sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type WithId<T> = T & { id: string };

const statuses: OrderStatus[] = ["Pending", "Shipped", "Delivered", "Cancelled"];

export default function AdminOrders() {
  const [orders, setOrders] = useState<Array<WithId<OrderDoc>>>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "orders"), (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDoc) })));
    });
    return () => unsub();
  }, []);

  const revenue = useMemo(() => {
    return orders
      .filter((o) => o.status !== "Cancelled")
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [orders]);

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status,
        updatedAt: serverTimestamp(),
      });
      toast.success("Order updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update order");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-muted-foreground">
          View orders and update status. Revenue (non-cancelled): ₹{revenue.toLocaleString()}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.id}</TableCell>
                    <TableCell className="text-sm">{o.userId}</TableCell>
                    <TableCell className="text-right">{Array.isArray(o.items) ? o.items.length : 0}</TableCell>
                    <TableCell className="text-right">₹{Number(o.total ?? 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Select value={o.status ?? "Pending"} onValueChange={(v) => updateStatus(o.id, v as OrderStatus)}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      No orders yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
