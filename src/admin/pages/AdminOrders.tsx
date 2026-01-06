import { useState, useEffect, useMemo } from "react";
import { collection, query, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Package,
  Search,
  Filter,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  Loader2,
  Eye,
  Download,
  RefreshCw,
  ChevronDown,
  MapPin,
  Phone,
  Mail,
  FileText,
  Calendar,
  AlertCircle,
  MoreHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { OrderDoc, OrderStatus } from "@/lib/models";
import { updateOrderStatus, updateOrder, deleteOrder, formatCurrency, formatOrderDate, exportOrdersToCSV } from "@/lib/orders";
import { cn } from "@/lib/utils";

type OrderWithId = OrderDoc & { id: string };

const statusConfig: Record<OrderStatus, { icon: typeof Clock; color: string; bgColor: string; label: string }> = {
  Pending: { icon: Clock, color: "text-amber-600", bgColor: "bg-amber-100 dark:bg-amber-900/30", label: "Pending" },
  Confirmed: { icon: CheckCircle, color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/30", label: "Confirmed" },
  Shipped: { icon: Truck, color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30", label: "Shipped" },
  Delivered: { icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30", label: "Delivered" },
  Cancelled: { icon: XCircle, color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30", label: "Cancelled" },
};

const allStatuses: OrderStatus[] = ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"];

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderWithId | null>(null);
  const [showOrderSheet, setShowOrderSheet] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // Status update form
  const [newStatus, setNewStatus] = useState<OrderStatus>("Pending");
  const [statusNote, setStatusNote] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippingCarrier, setShippingCarrier] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  // Real-time orders subscription
  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as OrderDoc),
      }));
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer.phone.includes(searchQuery);
      
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayOrders = orders.filter((o) => {
      if (!o.createdAt) return false;
      const orderDate = o.createdAt instanceof Timestamp ? o.createdAt.toDate() : new Date(o.createdAt as unknown as string);
      return orderDate >= today;
    });

    return {
      total: orders.length,
      pending: orders.filter((o) => o.status === "Pending").length,
      confirmed: orders.filter((o) => o.status === "Confirmed").length,
      shipped: orders.filter((o) => o.status === "Shipped").length,
      delivered: orders.filter((o) => o.status === "Delivered").length,
      cancelled: orders.filter((o) => o.status === "Cancelled").length,
      todayCount: todayOrders.length,
      todayRevenue: todayOrders.reduce((sum, o) => sum + o.total, 0),
      totalRevenue: orders.filter((o) => o.status !== "Cancelled").reduce((sum, o) => sum + o.total, 0),
    };
  }, [orders]);

  const openOrderDetails = (order: OrderWithId) => {
    setSelectedOrder(order);
    setShowOrderSheet(true);
  };

  const openStatusUpdate = (order: OrderWithId) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setStatusNote("");
    setTrackingNumber(order.trackingNumber || "");
    setShippingCarrier(order.shippingCarrier || "");
    setAdminNotes(order.adminNotes || "");
    setShowStatusDialog(true);
  };

  const openCancelOrder = (order: OrderWithId) => {
    setSelectedOrder(order);
    setCancellationReason("");
    setShowCancelDialog(true);
  };

  const handleStatusUpdate = async () => {
    if (!selectedOrder) return;
    setUpdating(true);
    try {
      await updateOrderStatus(selectedOrder.id, newStatus, statusNote || undefined);
      
      if (trackingNumber || shippingCarrier || adminNotes) {
        await updateOrder(selectedOrder.id, {
          trackingNumber: trackingNumber || undefined,
          shippingCarrier: shippingCarrier || undefined,
          adminNotes: adminNotes || undefined,
        });
      }
      
      toast.success(`Order status updated to ${newStatus}`);
      setShowStatusDialog(false);
    } catch (error) {
      toast.error("Failed to update order status");
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    setUpdating(true);
    try {
      await updateOrderStatus(selectedOrder.id, "Cancelled", cancellationReason);
      if (cancellationReason) {
        await updateOrder(selectedOrder.id, { cancellationReason });
      }
      toast.success("Order cancelled successfully");
      setShowCancelDialog(false);
    } catch (error) {
      toast.error("Failed to cancel order");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;
    setUpdating(true);
    try {
      await deleteOrder(selectedOrder.id);
      toast.success("Order deleted successfully");
      setShowDeleteDialog(false);
      setShowOrderSheet(false);
    } catch (error) {
      toast.error("Failed to delete order");
    } finally {
      setUpdating(false);
    }
  };

  const handleExportCSV = () => {
    const csv = exportOrdersToCSV(filteredOrders);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Orders exported successfully");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Orders</h1>
          <p className="text-muted-foreground">Manage and track customer orders</p>
        </div>
        <Button onClick={handleExportCSV} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Today's Orders</CardDescription>
            <CardTitle className="text-3xl">{stats.todayCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Revenue: {formatCurrency(stats.todayRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Orders</CardDescription>
            <CardTitle className="text-3xl text-amber-600">{stats.pending}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>In Transit</CardDescription>
            <CardTitle className="text-3xl text-blue-600">{stats.shipped}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Being delivered</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className="text-2xl text-green-600">{formatCurrency(stats.totalRevenue)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{stats.delivered} delivered</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by order #, name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                {allStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status} ({orders.filter((o) => o.status === status).length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No orders found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => {
                    const config = statusConfig[order.status];
                    const StatusIcon = config.icon;
                    return (
                      <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openOrderDetails(order)}>
                        <TableCell>
                          <div>
                            <p className="font-mono font-medium">{order.orderNumber}</p>
                            {!order.emailSent && (
                              <Badge variant="outline" className="text-xs mt-1">Email pending</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{order.customer.name}</p>
                            <p className="text-sm text-muted-foreground">{order.customer.phone}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{order.items.length} item{order.items.length !== 1 ? "s" : ""}</p>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{formatCurrency(order.total)}</p>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("gap-1", config.bgColor, config.color)}>
                            <StatusIcon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-muted-foreground">{formatOrderDate(order.createdAt)}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openOrderDetails(order); }}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openStatusUpdate(order); }}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Update Status
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {order.status !== "Cancelled" && (
                                <DropdownMenuItem className="text-red-600" onClick={(e) => { e.stopPropagation(); openCancelOrder(order); }}>
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Cancel Order
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Order Details Sheet */}
      <Sheet open={showOrderSheet} onOpenChange={setShowOrderSheet}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedOrder && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono">{selectedOrder.orderNumber}</SheetTitle>
                <SheetDescription>
                  Placed on {formatOrderDate(selectedOrder.createdAt)}
                </SheetDescription>
              </SheetHeader>
              
              <div className="mt-6 space-y-6">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <Badge className={cn("gap-1 px-3 py-1", statusConfig[selectedOrder.status].bgColor, statusConfig[selectedOrder.status].color)}>
                    {(() => { const Icon = statusConfig[selectedOrder.status].icon; return <Icon className="h-4 w-4" />; })()}
                    {selectedOrder.status}
                  </Badge>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => openStatusUpdate(selectedOrder)}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Update Status
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Customer Info */}
                <div>
                  <h4 className="font-medium mb-3">Customer Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{selectedOrder.customer.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      {selectedOrder.customer.email}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {selectedOrder.customer.phone}
                    </div>
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4 mt-0.5" />
                      <span>
                        {selectedOrder.customer.address}, {selectedOrder.customer.city}, {selectedOrder.customer.state} - {selectedOrder.customer.pincode}
                      </span>
                    </div>
                    {selectedOrder.customer.notes && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <FileText className="h-4 w-4 mt-0.5" />
                        <span>{selectedOrder.customer.notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Order Items */}
                <div>
                  <h4 className="font-medium mb-3">Order Items</h4>
                  <div className="space-y-3">
                    {selectedOrder.items.map((item, index) => (
                      <div key={index} className="flex gap-3">
                        <img src={item.imageUrl} alt={item.name} className="w-14 h-14 object-cover rounded-lg" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground">Qty: {item.qty} × {formatCurrency(item.price)}</p>
                        </div>
                        <p className="font-medium">{formatCurrency(item.price * item.qty)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Order Summary */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>{selectedOrder.shipping === 0 ? "Free" : formatCurrency(selectedOrder.shipping)}</span>
                  </div>
                  {selectedOrder.discount && selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(selectedOrder.discount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(selectedOrder.total)}</span>
                  </div>
                </div>

                {/* Tracking Info */}
                {selectedOrder.trackingNumber && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-2">Shipment Tracking</h4>
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
                        <p><span className="text-muted-foreground">Carrier:</span> {selectedOrder.shippingCarrier || "Standard"}</p>
                        <p><span className="text-muted-foreground">Tracking:</span> <span className="font-mono">{selectedOrder.trackingNumber}</span></p>
                      </div>
                    </div>
                  </>
                )}

                {/* Admin Notes */}
                {selectedOrder.adminNotes && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-2">Admin Notes</h4>
                      <p className="text-sm text-muted-foreground">{selectedOrder.adminNotes}</p>
                    </div>
                  </>
                )}

                {/* Timeline */}
                {selectedOrder.timeline && selectedOrder.timeline.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-3">Order Timeline</h4>
                      <div className="space-y-3">
                        {selectedOrder.timeline.map((event, index) => (
                          <div key={index} className="flex gap-3">
                            <div className={cn("w-2 h-2 rounded-full mt-2", statusConfig[event.status].bgColor.replace("bg-", "bg-").replace("/30", ""))} />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{event.status}</p>
                              {event.note && <p className="text-xs text-muted-foreground">{event.note}</p>}
                              <p className="text-xs text-muted-foreground">{formatOrderDate(event.timestamp)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Danger Zone */}
                <Separator />
                <div className="pt-4">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    Delete Order
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Update Status Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
            <DialogDescription>
              Change the status and add tracking information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as OrderStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allStatuses.filter(s => s !== "Cancelled").map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {newStatus === "Shipped" && (
              <>
                <div className="space-y-2">
                  <Label>Shipping Carrier</Label>
                  <Input
                    placeholder="e.g., BlueDart, DTDC, Delhivery"
                    value={shippingCarrier}
                    onChange={(e) => setShippingCarrier(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tracking Number</Label>
                  <Input
                    placeholder="Enter tracking number"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Status Note (Optional)</Label>
              <Textarea
                placeholder="Add a note for this status update"
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Admin Notes (Internal)</Label>
              <Textarea
                placeholder="Internal notes visible only to admins"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>Cancel</Button>
            <Button onClick={handleStatusUpdate} disabled={updating}>
              {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this order? This will restore the product stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>Cancellation Reason</Label>
            <Textarea
              className="mt-2"
              placeholder="Enter reason for cancellation"
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Order</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelOrder} className="bg-red-600 hover:bg-red-700" disabled={updating}>
              {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Order Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the order from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOrder} className="bg-red-600 hover:bg-red-700" disabled={updating}>
              {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
