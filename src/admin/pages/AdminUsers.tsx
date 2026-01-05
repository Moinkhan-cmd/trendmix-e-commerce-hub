import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, orderBy, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserDoc, OrderDoc } from "@/lib/models";
import { toast } from "@/components/ui/sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Search, ChevronLeft, ChevronRight, Eye, User, ShoppingBag, Ban } from "lucide-react";

type WithId<T> = T & { id: string };

const ITEMS_PER_PAGE = 10;

export default function AdminUsers() {
  const [users, setUsers] = useState<Array<WithId<UserDoc>>>([]);
  const [orders, setOrders] = useState<Array<WithId<OrderDoc>>>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<WithId<UserDoc> | null>(null);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as UserDoc) })));
    });
    const unsubOrders = onSnapshot(
      query(collection(db, "orders"), orderBy("createdAt", "desc")),
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDoc) })));
      }
    );
    return () => {
      unsubUsers();
      unsubOrders();
    };
  }, []);

  // Calculate stats per user
  const userStats = useMemo(() => {
    const map = new Map<string, { orderCount: number; totalSpent: number }>();
    orders.forEach((o) => {
      const existing = map.get(o.userId) || { orderCount: 0, totalSpent: 0 };
      existing.orderCount++;
      if (o.status !== "Cancelled") {
        existing.totalSpent += Number(o.total) || 0;
      }
      map.set(o.userId, existing);
    });
    return map;
  }, [orders]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.displayName || "").toLowerCase().includes(search.toLowerCase()) ||
        u.id.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "blocked" && u.blocked) ||
        (filterStatus === "active" && !u.blocked);
      return matchesSearch && matchesStatus;
    });
  }, [users, search, filterStatus]);

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterStatus]);

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

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const userOrders = useMemo(() => {
    if (!selectedUser) return [];
    return orders.filter((o) => o.userId === selectedUser.id);
  }, [orders, selectedUser]);

  const blockedCount = useMemo(() => users.filter((u) => u.blocked).length, [users]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">
          Manage users and view their order history ({users.length} total, {blockedCount} blocked)
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <Card className="cursor-pointer hover:border-primary/50" onClick={() => setFilterStatus("all")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Users</span>
              <Badge variant="secondary">{users.length}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50" onClick={() => setFilterStatus("active")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Active</span>
              <Badge variant="secondary" className="bg-green-100 text-green-700">{users.length - blockedCount}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50" onClick={() => setFilterStatus("blocked")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Blocked</span>
              <Badge variant="secondary" className="bg-red-100 text-red-700">{blockedCount}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email, name, or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-center">Orders</TableHead>
                  <TableHead className="text-right">Total Spent</TableHead>
                  <TableHead className="text-center">Blocked</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.map((u) => {
                  const stats = userStats.get(u.id) || { orderCount: 0, totalSpent: 0 };
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{u.displayName || "No name"}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(u.createdAt)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{stats.orderCount}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{stats.totalSpent.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={Boolean(u.blocked)}
                          onCheckedChange={(v) => setBlocked(u.id, v)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setSelectedUser(u)}>
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {paginatedUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Details Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(v) => !v && setSelectedUser(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User Details
            </DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6">
              {/* User Info */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{selectedUser.displayName || "No name"}</h3>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Joined: {formatDate(selectedUser.createdAt)}
                    </p>
                  </div>
                </div>
                {selectedUser.blocked && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <Ban className="h-3 w-3" /> Blocked
                  </Badge>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Total Orders</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{userOrders.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Total Spent</div>
                    <p className="text-2xl font-bold mt-1">
                      ₹{(userStats.get(selectedUser.id)?.totalSpent || 0).toLocaleString("en-IN")}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* User ID */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">User ID</p>
                <p className="font-mono text-xs bg-muted p-2 rounded">{selectedUser.id}</p>
              </div>

              {/* Recent Orders */}
              <div>
                <h3 className="font-medium mb-3">Recent Orders ({userOrders.length})</h3>
                {userOrders.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order ID</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-center">Items</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userOrders.slice(0, 5).map((o) => (
                          <TableRow key={o.id}>
                            <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}...</TableCell>
                            <TableCell className="text-sm">{formatDate(o.createdAt)}</TableCell>
                            <TableCell className="text-center">{o.items?.length || 0}</TableCell>
                            <TableCell className="text-right">₹{Number(o.total).toLocaleString("en-IN")}</TableCell>
                            <TableCell>
                              <Badge variant={o.status === "Delivered" ? "default" : o.status === "Cancelled" ? "destructive" : "secondary"}>
                                {o.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No orders yet</p>
                )}
              </div>

              {/* Block/Unblock */}
              <div className="flex items-center justify-between border-t pt-4">
                <div>
                  <p className="text-sm font-medium">Block User</p>
                  <p className="text-xs text-muted-foreground">Blocked users cannot place orders</p>
                </div>
                <Switch
                  checked={Boolean(selectedUser.blocked)}
                  onCheckedChange={(v) => {
                    setBlocked(selectedUser.id, v);
                    setSelectedUser({ ...selectedUser, blocked: v });
                  }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
