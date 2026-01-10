import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  CreditCard,
  Loader2,
  MapPin,
  ShoppingBag,
  Truck,
  CheckCircle,
  User,
  Phone,
  Mail,
  Home,
  FileText,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { toast } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { useShop } from "@/store/shop";
import { createOrder, formatCurrency, validateOrderItems } from "@/lib/orders";
import { cn } from "@/lib/utils";

const checkoutSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z
    .string()
    .regex(/^\d{10}$/, "Please enter a valid 10-digit phone number"),
  address: z.string().min(10, "Please enter your complete address"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().regex(/^\d{6}$/, "Please enter a valid 6-digit pincode"),
  notes: z.string().optional(),
  paymentMethod: z.enum(["cod", "online"], {
    required_error: "Please select a payment method",
  }),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

const SHIPPING_THRESHOLD = 999;
const SHIPPING_COST = 49;

export default function Checkout() {
  const navigate = useNavigate();
  const { cartItems, cartCount, subtotal: cartSubtotal, clearCart } = useShop();
  const [loading, setLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ orderNumber: string } | null>(null);

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      notes: "",
      paymentMethod: "cod",
    },
  });

  const subtotal = cartSubtotal;
  const shipping = subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const total = subtotal + shipping;

  const onSubmit = async (data: CheckoutFormData) => {
    if (cartItems.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setLoading(true);

    try {
      // Validate stock availability
      const validation = await validateOrderItems(
        cartItems.map((item) => ({ productId: item.product.id, qty: item.qty }))
      );

      if (!validation.valid) {
        validation.errors.forEach((error) => toast.error(error));
        setLoading(false);
        return;
      }

      const orderItems = cartItems.map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        qty: item.qty,
        price: item.product.price,
        imageUrl: item.product.image || "",
      }));

      const result = await createOrder({
        items: orderItems,
        customer: {
          name: data.name,
          email: data.email.toLowerCase(),
          phone: data.phone,
          address: data.address,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          notes: data.notes,
        },
        subtotal,
        shipping,
        total,
      });

      setOrderSuccess({ orderNumber: result.orderNumber });
      clearCart();
      toast.success("Order placed successfully!");
    } catch (error) {
      console.error("Order error:", error);
      const code = (error as { code?: unknown } | null)?.code;
      const message = (error as { message?: unknown } | null)?.message;

      // In development, surface the underlying error to speed up debugging.
      if (import.meta.env.DEV) {
        const details = [
          typeof code === "string" ? `code=${code}` : null,
          typeof message === "string" ? message : null,
        ]
          .filter(Boolean)
          .join(" • ");
        toast.error(details ? `Failed to place order: ${details}` : "Failed to place order (unknown error)");
        return;
      }

      if (code === "permission-denied") {
        toast.error("Checkout is temporarily unavailable (permission denied).");
      } else if (code === "unavailable") {
        toast.error("Network error while placing order. Please try again.");
      } else {
        toast.error("Failed to place order. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (cartItems.length === 0 && !orderSuccess) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container py-12">
          <div className="max-w-md mx-auto text-center">
            <div className="mb-6 flex justify-center">
              <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center">
                <ShoppingBag className="h-12 w-12 text-muted-foreground" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2">Your Cart is Empty</h1>
            <p className="text-muted-foreground mb-6">
              Add some products to your cart before checking out.
            </p>
            <Button asChild size="lg">
              <Link to="/products">
                <ShoppingBag className="mr-2 h-5 w-5" />
                Browse Products
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
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link to="/cart">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Cart
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Checkout</h1>
          <p className="text-muted-foreground mt-1">
            Complete your order by filling in the details below.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          {/* Checkout Form */}
          <div className="space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Contact Information
                    </CardTitle>
                    <CardDescription>
                      We'll use this to send order updates
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Full Name *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                              <Input className="pl-10" placeholder="John Doe" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                              <Input className="pl-10" type="email" placeholder="john@example.com" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                              <Input className="pl-10" type="tel" placeholder="9876543210" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Shipping Address */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Shipping Address
                    </CardTitle>
                    <CardDescription>
                      Where should we deliver your order?
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Address *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Home className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                              <Textarea
                                className="pl-10 min-h-[80px]"
                                placeholder="House/Flat No., Building, Street, Landmark"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City *</FormLabel>
                          <FormControl>
                            <Input placeholder="Mumbai" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State *</FormLabel>
                          <FormControl>
                            <Input placeholder="Maharashtra" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="pincode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pincode *</FormLabel>
                          <FormControl>
                            <Input placeholder="400001" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Order Notes (Optional)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                              <Input className="pl-10" placeholder="Any special instructions" {...field} />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Add any special delivery instructions
                          </FormDescription>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Payment Method */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Payment Method
                    </CardTitle>
                    <CardDescription>
                      Choose how you'd like to pay
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="grid gap-4 sm:grid-cols-2"
                            >
                              <div>
                                <RadioGroupItem
                                  value="cod"
                                  id="cod"
                                  className="peer sr-only"
                                />
                                <label
                                  htmlFor="cod"
                                  className={cn(
                                    "flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-all",
                                    field.value === "cod" && "border-primary bg-primary/5"
                                  )}
                                >
                                  <Truck className="mb-3 h-6 w-6" />
                                  <span className="font-medium">Cash on Delivery</span>
                                  <span className="text-xs text-muted-foreground">Pay when you receive</span>
                                </label>
                              </div>
                              <div>
                                <RadioGroupItem
                                  value="online"
                                  id="online"
                                  className="peer sr-only"
                                  disabled
                                />
                                <label
                                  htmlFor="online"
                                  className={cn(
                                    "flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 cursor-not-allowed opacity-50",
                                    field.value === "online" && "border-primary bg-primary/5"
                                  )}
                                >
                                  <CreditCard className="mb-3 h-6 w-6" />
                                  <span className="font-medium">Online Payment</span>
                                  <Badge variant="secondary" className="mt-1">Coming Soon</Badge>
                                </label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Mobile Submit Button */}
                <div className="lg:hidden">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Placing Order...
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="mr-2 h-5 w-5" />
                        Place Order - {formatCurrency(total)}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:sticky lg:top-4 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
                <CardDescription>
                    {cartCount} item{cartCount !== 1 ? "s" : ""} in your cart
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Cart Items */}
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {cartItems.map((item) => (
                      <div key={item.product.id} className="flex gap-3">
                      <img
                          src={item.product.image || "/placeholder.svg"}
                          alt={item.product.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                      <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.qty}</p>
                          <p className="text-sm font-medium">{formatCurrency(item.product.price * item.qty)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Totals */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>
                      {shipping === 0 ? (
                        <span className="text-green-600">Free</span>
                      ) : (
                        formatCurrency(shipping)
                      )}
                    </span>
                  </div>
                  {subtotal < SHIPPING_THRESHOLD && (
                    <p className="text-xs text-muted-foreground">
                      Add {formatCurrency(SHIPPING_THRESHOLD - subtotal)} more for free shipping
                    </p>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="hidden lg:block">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={loading}
                  onClick={form.handleSubmit(onSubmit)}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Placing Order...
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="mr-2 h-5 w-5" />
                      Place Order
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            {/* Trust Badges */}
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-center text-xs">
                <div>
                  <Truck className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <span className="text-muted-foreground">Free shipping over Rs.999</span>
                </div>
                <div>
                  <CheckCircle className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <span className="text-muted-foreground">Secure checkout</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      {/* Success Dialog */}
      <Dialog open={!!orderSuccess} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <DialogTitle className="text-2xl">Order Placed!</DialogTitle>
            <DialogDescription className="text-base">
              Thank you for your order. We'll send you an email confirmation shortly.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 p-4 bg-muted rounded-lg text-center">
            <p className="text-sm text-muted-foreground mb-1">Order Number</p>
            <p className="font-mono font-bold text-lg">{orderSuccess?.orderNumber}</p>
          </div>
          <div className="flex flex-col gap-3 mt-4">
            <Button asChild>
              <Link to={`/track-order`}>
                <Truck className="mr-2 h-4 w-4" />
                Track Your Order
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/products">
                <ShoppingBag className="mr-2 h-4 w-4" />
                Continue Shopping
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
