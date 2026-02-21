import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import {
  Package,
  Search,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  Loader2,
  ShoppingBag,
  Phone,
  Mail,
  ArrowLeft,
  MapPin,
  ExternalLink,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";

import { getOrderByNumber, getOrdersByEmail, getOrdersByPhone, formatCurrency, formatOrderDate } from "@/lib/orders";
import type { OrderDoc, OrderStatus } from "@/lib/models";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/AuthProvider";

const orderNumberSchema = z.object({
  orderNumber: z.string().min(1, "Order number is required"),
});

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email"),
});

const phoneSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Phone must be 10 digits"),
});

type OrderWithId = OrderDoc & { id: string };

const statusConfig: Record<OrderStatus, { icon: typeof Clock; color: string; bgColor: string }> = {
  Pending: { icon: Clock, color: "text-amber-600", bgColor: "bg-amber-100 dark:bg-amber-900/30" },
  Confirmed: { icon: CheckCircle, color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/30" },
  Shipped: { icon: Truck, color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  Delivered: { icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30" },
  Cancelled: { icon: XCircle, color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30" },
};

const statusOrder: OrderStatus[] = ["Pending", "Confirmed", "Shipped", "Delivered"];

export default function OrderTracking() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<OrderWithId[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const orderNumberForm = useForm({
    resolver: zodResolver(orderNumberSchema),
    defaultValues: { orderNumber: "" },
  });

  const emailForm = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const phoneForm = useForm({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "" },
  });

  const searchByOrderNumber = async (data: { orderNumber: string }) => {
    setLoading(true);
    setSearched(true);
    try {
      const order = await getOrderByNumber(data.orderNumber.toUpperCase());
      setOrders(order ? [order] : []);
      if (!order) toast.info("No order found with this order number");
    } catch {
      toast.error("Failed to search order");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const searchByEmail = async (data: { email: string }) => {
    setLoading(true);
    setSearched(true);
    try {
      const results = await getOrdersByEmail(data.email);
      setOrders(results);
      if (results.length === 0) toast.info("No orders found for this email");
    } catch {
      toast.error("Failed to search orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const searchByPhone = async (data: { phone: string }) => {
    setLoading(true);
    setSearched(true);
    try {
      const results = await getOrdersByPhone(data.phone);
      setOrders(results);
      if (results.length === 0) toast.info("No orders found for this phone number");
    } catch {
      toast.error("Failed to search orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container py-8 flex items-center justify-center">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <CardTitle>Login Required</CardTitle>
              <CardDescription>
                Sign in with your verified account to securely track your orders.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="w-full">
                <Link to="/login" state={{ from: { pathname: "/track-order" } }}>
                  Log In
                </Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link to="/signup">Create Account</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-8">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Track Your Order</h1>
          <p className="text-muted-foreground mt-1">
            Enter your order details to check the status of your order.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
          {/* Search Forms */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Find Your Order
                </CardTitle>
                <CardDescription>
                  Search using your order number, email, or phone number
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="orderNumber" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="orderNumber">Order #</TabsTrigger>
                    <TabsTrigger value="email">Email</TabsTrigger>
                    <TabsTrigger value="phone">Phone</TabsTrigger>
                  </TabsList>

                  <TabsContent value="orderNumber" className="mt-4">
                    <Form {...orderNumberForm}>
                      <form onSubmit={orderNumberForm.handleSubmit(searchByOrderNumber)} className="space-y-4">
                        <FormField
                          control={orderNumberForm.control}
                          name="orderNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Order Number</FormLabel>
                              <FormControl>
                                <Input placeholder="TM-20260106-XXXX" {...field} disabled={loading} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" className="w-full" disabled={loading}>
                          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                          {loading ? "Searching..." : "Track Order"}
                        </Button>
                      </form>
                    </Form>
                  </TabsContent>

                  <TabsContent value="email" className="mt-4">
                    <Form {...emailForm}>
                      <form onSubmit={emailForm.handleSubmit(searchByEmail)} className="space-y-4">
                        <FormField
                          control={emailForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="your@email.com" {...field} disabled={loading} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" className="w-full" disabled={loading}>
                          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                          {loading ? "Searching..." : "Find Orders"}
                        </Button>
                      </form>
                    </Form>
                  </TabsContent>

                  <TabsContent value="phone" className="mt-4">
                    <Form {...phoneForm}>
                      <form onSubmit={phoneForm.handleSubmit(searchByPhone)} className="space-y-4">
                        <FormField
                          control={phoneForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number</FormLabel>
                              <FormControl>
                                <Input type="tel" placeholder="10 digit mobile number" {...field} disabled={loading} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" className="w-full" disabled={loading}>
                          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Phone className="mr-2 h-4 w-4" />}
                          {loading ? "Searching..." : "Find Orders"}
                        </Button>
                      </form>
                    </Form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {loading && (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            )}

            {!loading && searched && orders.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium">No Orders Found</h3>
                  <p className="text-muted-foreground mt-1">We couldn't find any orders matching your search.</p>
                  <Button asChild className="mt-4">
                    <Link to="/products">
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      Start Shopping
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {!loading && orders.length > 0 && (
              <div className="space-y-4">
                {orders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            )}

            {!searched && !loading && (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Search className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-medium">Search for Your Order</h3>
                  <p className="text-muted-foreground mt-1">Use the form on the left to find your order status.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function OrderCard({ order }: { order: OrderWithId }) {
  const config = statusConfig[order.status];
  const StatusIcon = config.icon;
  const currentStatusIndex = statusOrder.indexOf(order.status);
  const isCancelled = order.status === "Cancelled";

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-mono">{order.orderNumber}</CardTitle>
            <CardDescription>Placed on {formatOrderDate(order.createdAt)}</CardDescription>
          </div>
          <Badge className={cn("px-3 py-1", config.bgColor, config.color)}>
            <StatusIcon className="h-4 w-4 mr-1" />
            {order.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Tracker */}
        {!isCancelled && (
          <div className="relative">
            <div className="flex justify-between mb-2">
              {statusOrder.map((status, index) => {
                const isCompleted = index <= currentStatusIndex;
                const isCurrent = index === currentStatusIndex;
                const Icon = statusConfig[status].icon;
                return (
                  <div key={status} className="flex flex-col items-center flex-1">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                        isCompleted
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-muted border-muted-foreground/30 text-muted-foreground",
                        isCurrent && "ring-4 ring-primary/20"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={cn("text-xs mt-2 text-center", isCompleted ? "text-primary font-medium" : "text-muted-foreground")}>
                      {status}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted -z-10 mx-12">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(currentStatusIndex / (statusOrder.length - 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {isCancelled && order.cancellationReason && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">
              <strong>Cancellation Reason:</strong> {order.cancellationReason}
            </p>
          </div>
        )}

        <Separator />

        {/* Order Items */}
        <div>
          <h4 className="font-medium mb-3">Order Items</h4>
          <div className="space-y-3">
            {order.items.map((item, index) => (
              <div key={index} className="flex gap-4">
                <img src={item.imageUrl} alt={item.name} className="w-16 h-16 object-cover rounded-lg" />
                <div className="flex-1">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">Qty: {item.qty}</p>
                </div>
                <p className="font-medium">{formatCurrency(item.price * item.qty)}</p>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Delivery & Payment Info */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Delivery Address
            </h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">{order.customer.name}</p>
              <p>{order.customer.address}</p>
              <p>{order.customer.city}, {order.customer.state} - {order.customer.pincode}</p>
              <p>{order.customer.phone}</p>
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-2">Order Summary</h4>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>{order.shipping === 0 ? "Free" : formatCurrency(order.shipping)}</span>
              </div>
              {order.discount && order.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(order.discount)}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tracking Info */}
        {(order.trackingNumber || order.awb_code) && (
          <>
            <Separator />
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-2">
              <h4 className="font-medium mb-1">Shipment Tracking</h4>
              <p className="text-sm">
                <span className="text-muted-foreground">Carrier:</span>{" "}
                {order.courier_name || order.shippingCarrier || "Standard Shipping"}
              </p>
              {(order.awb_code || order.trackingNumber) && (
                <p className="text-sm">
                  <span className="text-muted-foreground">AWB / Tracking #:</span>{" "}
                  <span className="font-mono font-medium">{order.awb_code || order.trackingNumber}</span>
                </p>
              )}
              {order.shipment_status && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Shipment Status:</span>{" "}
                  <span className="capitalize font-medium">{order.shipment_status.replace(/_/g, " ")}</span>
                </p>
              )}
              {order.last_location && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Last Location:</span> {order.last_location}
                </p>
              )}
              {order.delivery_date && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Delivery Date:</span> {order.delivery_date}
                </p>
              )}
              {order.tracking_url && (
                <a
                  href={order.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline mt-1"
                >
                  Track on Shiprocket
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
