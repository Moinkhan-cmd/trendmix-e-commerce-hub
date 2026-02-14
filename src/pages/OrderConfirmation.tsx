import { useEffect, useState } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import {
  CheckCircle,
  Package,
  Truck,
  MapPin,
  Calendar,
  CreditCard,
  Smartphone,
  Banknote,
  ArrowRight,
  ShoppingBag,
  Copy,
  Check,
  Loader2,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CheckoutSteps from "@/components/CheckoutSteps";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getOrderByNumber, formatCurrency } from "@/lib/orders";
import type { OrderDoc, PaymentInfo } from "@/lib/models";

type OrderConfirmationState = {
  orderNumber?: string;
  transactionId?: string;
  paymentMethod?: string;
  guestCheckout?: boolean;
  guestEmail?: string;
};

export default function OrderConfirmation() {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Get order details from navigation state if available
  const navState = location.state as OrderConfirmationState | null;

  useEffect(() => {
    const fetchOrder = async () => {
      if (navState?.guestCheckout) {
        setLoading(false);
        return;
      }

      if (!orderId) {
        setLoading(false);
        return;
      }

      try {
        const orderData = await getOrderByNumber(orderId);
        setOrder(orderData);
      } catch (error) {
        console.error("Failed to fetch order:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, navState?.guestCheckout]);

  const handleCopyOrderNumber = async () => {
    const orderNumber = order?.orderNumber || orderId || "";
    await navigator.clipboard.writeText(orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPaymentMethodIcon = (method?: PaymentInfo["method"]) => {
    switch (method) {
      case "online":
        return <CreditCard className="h-4 w-4" />;
      case "upi":
        return <Smartphone className="h-4 w-4" />;
      case "cod":
        return <Banknote className="h-4 w-4" />;
      default:
        return <CreditCard className="h-4 w-4" />;
    }
  };

  const getPaymentMethodLabel = (method?: PaymentInfo["method"]) => {
    switch (method) {
      case "online":
        return "Card Payment";
      case "upi":
        return "UPI Payment";
      case "cod":
        return "Cash on Delivery";
      default:
        return "Payment";
    }
  };

  const getPaymentStatusBadge = (status?: PaymentInfo["status"]) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Paid</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container py-8 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading order details...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!order && !orderId) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container py-12">
          <div className="max-w-md mx-auto text-center">
            <div className="mb-6 flex justify-center">
              <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center">
                <Package className="h-12 w-12 text-muted-foreground" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2">No Order Found</h1>
            <p className="text-muted-foreground mb-6">
              We couldn't find the order you're looking for.
            </p>
            <Button asChild>
              <Link to="/products">
                <ShoppingBag className="mr-2 h-5 w-5" />
                Continue Shopping
              </Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-8">
        {/* Step Indicator */}
        <CheckoutSteps currentStep="confirmation" className="mb-8" />

        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-green-700 dark:text-green-300 mb-2">
            Order Confirmed!
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Thank you for your order. We've sent a confirmation email with your order details.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-6">
          {/* Order Number Card */}
          <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
            <CardContent className="py-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <p className="text-sm text-muted-foreground mb-1">Order Number</p>
                  <p className="text-2xl font-mono font-bold">
                    {order?.orderNumber || orderId}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyOrderNumber}
                  className="flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Order Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="h-5 w-5" />
                  Order Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge>{order?.status || "Pending"}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items</span>
                  <span>{order?.items?.length || 0} item(s)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(order?.subtotal || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>
                    {order?.shipping === 0 ? (
                      <span className="text-green-600">Free</span>
                    ) : (
                      formatCurrency(order?.shipping || 0)
                    )}
                  </span>
                </div>
                {order?.discount && order.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(order.discount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(order?.total || 0)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Payment Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="h-5 w-5" />
                  Payment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Method</span>
                  <span className="flex items-center gap-2">
                    {getPaymentMethodIcon(order?.payment?.method)}
                    {getPaymentMethodLabel(order?.payment?.method)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status</span>
                  {getPaymentStatusBadge(order?.payment?.status)}
                </div>
                {(order?.payment?.transactionId || navState?.transactionId) && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Transaction ID</span>
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                        {order?.payment?.transactionId || navState?.transactionId}
                      </span>
                    </div>
                  </>
                )}
                {order?.payment?.paidAt && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Paid At</span>
                      <span className="text-sm">
                        {order.payment.paidAt.toDate().toLocaleString()}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Shipping Details */}
          {order?.customer && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5" />
                  Delivery Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="font-medium">{order.customer.name}</p>
                  <p className="text-muted-foreground">{order.customer.address}</p>
                  <p className="text-muted-foreground">
                    {order.customer.city}, {order.customer.state} - {order.customer.pincode}
                  </p>
                  <p className="text-muted-foreground">Phone: {order.customer.phone}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Items */}
          {order?.items && order.items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShoppingBag className="h-5 w-5" />
                  Order Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.items.map((item, index) => (
                    <div key={index} className="flex gap-4">
                      <img
                        src={item.imageUrl || "/placeholder.svg"}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.name}</p>
                        <p className="text-sm text-muted-foreground">Qty: {item.qty}</p>
                        <p className="text-sm font-medium">
                          {formatCurrency(item.price * item.qty)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* What's Next */}
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5" />
                What's Next?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Order Confirmed</p>
                    <p className="text-xs text-muted-foreground">
                      We've received your order
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-muted-foreground">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Processing</p>
                    <p className="text-xs text-muted-foreground">
                      We're preparing your order
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-muted-foreground">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Shipped</p>
                    <p className="text-xs text-muted-foreground">
                      On the way to you
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <Link to="/track-order">
                <Truck className="mr-2 h-5 w-5" />
                Track Your Order
              </Link>
            </Button>
            <Button variant="outline" asChild size="lg">
              <Link to="/products">
                <ShoppingBag className="mr-2 h-5 w-5" />
                Continue Shopping
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {navState?.guestCheckout && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Create your Trendmix account</p>
                  <p className="text-sm text-muted-foreground">
                    Save this order and speed up your next checkout.
                  </p>
                </div>
                <Button asChild>
                  <Link to="/signup" state={{ email: navState.guestEmail }}>
                    Create Account
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

      </main>
      <Footer />
    </div>
  );
}
