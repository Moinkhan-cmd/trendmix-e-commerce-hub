import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserDoc } from "@/lib/models";
import { toast } from "@/components/ui/sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type WithId<T> = T & { id: string };

export default function AdminUsers() {
  const [users, setUsers] = useState<Array<WithId<UserDoc>>>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as UserDoc) })));
    });
    return () => unsub();
  }, []);

  const setBlocked = async (userId: string, blocked: boolean) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        blocked,
        updatedAt: serverTimestamp(),
      });
      toast.success(blocked ? "User blocked" : "User unblocked");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update user");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">View users and block/unblock access.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Blocked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-xs">{u.id}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Switch checked={Boolean(u.blocked)} onCheckedChange={(v) => setBlocked(u.id, v)} />
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-10">
                      No users yet.
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
