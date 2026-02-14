import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
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
  ArrowRight,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CheckoutSteps from "@/components/CheckoutSteps";
import PaymentMethodSelector from "@/components/PaymentMethodSelector";
import PaymentProcessingModal from "@/components/PaymentProcessingModal";
import CheckoutAuthModal from "@/components/CheckoutAuthModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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

import { useShop } from "@/store/shop";
import { createOrder, formatCurrency, validateOrderItems, validateCouponCode } from "@/lib/orders";
import {
  processPayment,
  validateCardNumber,
  validateExpiryDate,
  validateCVV,
  validateUpiId,
  type PaymentMethod,
  type CardDetails,
  type UpiDetails,
} from "@/lib/payment";
import { initiateRazorpayPayment } from "@/lib/razorpay";
import { getRecaptchaToken, isRecaptchaConfigured } from "@/lib/recaptcha";
import { disableGuestCheckout, enableGuestCheckout, isGuestCheckoutEnabled } from "@/lib/checkout-session";
import { validateCheckoutCoupon } from "@/lib/coupon";

const checkoutSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z
    .string()
    .regex(/^\d{10,13}$/, "Please enter a valid phone number (10-13 digits)"),
  address: z.string().min(10, "Please enter your complete address"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().regex(/^\d{6}$/, "Please enter a valid 6-digit pincode"),
  notes: z.string().optional(),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

const SHIPPING_THRESHOLD = 999;
const SHIPPING_COST = 49;

type CheckoutStep = "address" | "payment";
type PaymentModalStatus = "processing" | "success" | "failed";

export default function Checkout() {
  const navigate = useNavigate();
  const { cartItems, cartCount, subtotal: cartSubtotal, clearCart } = useShop();
  const {
    isAuthenticated,
    isEmailVerified,
    loading: authLoading,
    profile,
    resendVerificationEmail,
    refreshVerificationStatus,
  } = useAuth();
  
  // Multi-step state
  const [currentStep, setCurrentStep] = useState<CheckoutStep>("address");
  
  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("razorpay");
  const [cardDetails, setCardDetails] = useState<CardDetails>({
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    cardholderName: "",
  });
  const [upiDetails, setUpiDetails] = useState<UpiDetails>({ upiId: "" });
  const [paymentErrors, setPaymentErrors] = useState<{
    cardNumber?: string;
    expiryDate?: string;
    cvv?: string;
    cardholderName?: string;
    upiId?: string;
  }>({});
  
  // Processing state
  const [loading, setLoading] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentModalStatus, setPaymentModalStatus] = useState<PaymentModalStatus>("processing");
  const [paymentResult, setPaymentResult] = useState<{
    transactionId?: string;
    errorMessage?: string;
    orderNumber?: string;
  }>({});
  
  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [guestCheckout, setGuestCheckout] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  const isPaymentBlocked =
    (isAuthenticated && !isEmailVerified) ||
    (guestCheckout && paymentMethod !== "razorpay");

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
    },
  });

  // Pre-fill form with user profile data
  useEffect(() => {
    if (profile) {
      form.reset({
        name: profile.displayName || "",
        email: profile.email || "",
        phone: profile.phone || "",
        address: profile.address?.street || "",
        city: profile.address?.city || "",
        state: profile.address?.state || "",
        pincode: profile.address?.pincode || "",
        notes: "",
      });
    }
  }, [profile, form]);

  useEffect(() => {
    if (authLoading) return;
    setGuestCheckout(isGuestCheckoutEnabled());
  }, [authLoading]);

  useEffect(() => {
    if (authLoading) return;

    if (isAuthenticated) {
      setAuthModalOpen(false);
      disableGuestCheckout();
      setGuestCheckout(false);
      return;
    }

    if (!guestCheckout && cartItems.length > 0) {
      setAuthModalOpen(true);
    }
  }, [authLoading, isAuthenticated, guestCheckout, cartItems.length]);

  const subtotal = cartSubtotal;
  const shipping = subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const total = subtotal + shipping - discount;

  // Handle coupon code application
  const handleApplyCoupon = () => {
    if (!couponCode.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }

    const validation = validateCouponCode(couponCode.trim(), subtotal);
    
    if (validation.valid) {
      setDiscount(validation.discount);
      setCouponApplied(true);
      toast.success(`Coupon applied! You saved ${formatCurrency(validation.discount)}`);
    } else {
      setDiscount(0);
      setCouponApplied(false);
      toast.error(validation.error || "Invalid coupon code");
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode("");
    setDiscount(0);
    setCouponApplied(false);
    toast.success("Coupon removed");
  };

  // Validate payment details based on selected method
  const validatePaymentDetails = (): boolean => {
    const errors: typeof paymentErrors = {};
    let isValid = true;

    if (paymentMethod === "card") {
      const cardNumberClean = cardDetails.cardNumber.replace(/\s/g, "");
      const cardValidation = validateCardNumber(cardNumberClean);
      if (!cardValidation.valid) {
        errors.cardNumber = cardValidation.error;
        isValid = false;
      }

      const expiryValidation = validateExpiryDate(cardDetails.expiryDate);
      if (!expiryValidation.valid) {
        errors.expiryDate = expiryValidation.error;
        isValid = false;
      }

      const cvvValidation = validateCVV(cardDetails.cvv);
      if (!cvvValidation.valid) {
        errors.cvv = cvvValidation.error;
        isValid = false;
      }

      if (!cardDetails.cardholderName.trim()) {
        errors.cardholderName = "Cardholder name is required";
        isValid = false;
      }
    } else if (paymentMethod === "upi") {
      const upiValidation = validateUpiId(upiDetails.upiId);
      if (!upiValidation.valid) {
        errors.upiId = upiValidation.error;
        isValid = false;
      }
    }
    // COD doesn't need validation

    setPaymentErrors(errors);
    return isValid;
  };

  // Handle address form submission - move to payment step
  const handleAddressSubmit = async (data: CheckoutFormData) => {
    if (cartItems.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    // Validate stock availability
    setLoading(true);
    try {
      const validation = await validateOrderItems(
        cartItems.map((item) => ({ productId: item.product.id, qty: item.qty }))
      );

      if (!validation.valid) {
        validation.errors.forEach((error) => toast.error(error));
        setLoading(false);
        return;
      }

      // Move to payment step
      setCurrentStep("payment");
    } catch (error) {
      console.error("Validation error:", error);
      toast.error("Failed to validate cart. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle payment submission
  const handlePaymentSubmit = async () => {
    if (!isAuthenticated && !guestCheckout) {
      setAuthModalOpen(true);
      return;
    }

    if (isAuthenticated && !isEmailVerified) {
      toast.error("Verify your email before placing an order.");
      return;
    }

    if (guestCheckout && paymentMethod !== "razorpay") {
      toast.error("Guest checkout currently supports secure Razorpay payment only.");
      return;
    }

    // Razorpay doesn't need local validation — its own checkout handles that
    if (paymentMethod !== "razorpay") {
      if (!validatePaymentDetails()) {
        toast.error("Please fix the payment details");
        return;
      }
    }

    // ── Razorpay Flow ───────────────────────────────────────
    if (paymentMethod === "razorpay") {
      const recaptchaConfigured = isRecaptchaConfigured();

      if (guestCheckout && !recaptchaConfigured) {
        toast.error("Guest checkout is temporarily unavailable. Please sign in and place your order.");
        return;
      }

      setLoading(true);
      try {
        const recaptchaToken = recaptchaConfigured
          ? await getRecaptchaToken("checkout")
          : undefined;

        if (!recaptchaToken) {
          console.warn("[checkout] reCAPTCHA is not configured. Using legacy checkout fallback.");
        }

        const formData = form.getValues();

        const result = await initiateRazorpayPayment({
          recaptchaToken,
          fallbackAmountPaise: Math.round(total * 100),
          customerName: formData.name,
          customerEmail: formData.email,
          customerPhone: formData.phone,
          guestCheckout,
          guestEmail: guestCheckout ? formData.email : undefined,
          orderDetails: {
            items: cartItems.map((item) => ({
              productId: item.product.id,
              qty: item.qty,
            })),
            customer: {
              name: formData.name,
              email: formData.email.toLowerCase(),
              phone: formData.phone,
              address: formData.address,
              city: formData.city,
              state: formData.state,
              pincode: formData.pincode,
            },
          },
        });

        if (result.success) {
          let confirmationOrderNumber = result.orderNumber;

          if (!confirmationOrderNumber) {
            try {
              const orderItems = cartItems.map((item) => ({
                productId: item.product.id,
                name: item.product.name,
                qty: item.qty,
                price: item.product.price,
                imageUrl: item.product.image || "",
              }));

              const orderResult = await createOrder({
                items: orderItems,
                customer: {
                  name: formData.name,
                  email: formData.email.toLowerCase(),
                  phone: formData.phone,
                  address: formData.address,
                  city: formData.city,
                  state: formData.state,
                  pincode: formData.pincode,
                  notes: formData.notes,
                },
                subtotal,
                shipping,
                total,
                couponCode: couponApplied ? couponCode : undefined,
                discount: couponApplied ? discount : undefined,
                payment: {
                  method: "online",
                  status: result.verificationPending ? "pending" : "completed",
                  transactionId: result.paymentId,
                },
              });

              confirmationOrderNumber = orderResult.orderNumber;
            } catch (orderError) {
              console.error("Order creation fallback failed after successful payment:", orderError);
              confirmationOrderNumber = result.paymentId || `TM-${Date.now()}`;
              toast.info("Payment is successful. Your order is being finalized in the background.");
            }
          }

          if (result.verificationPending) {
            toast.info("Payment received. We're confirming it in the background.");
          }

          clearCart();
          navigate(`/order-confirmation/${confirmationOrderNumber}`, {
            state: {
              orderNumber: confirmationOrderNumber,
              transactionId: result.paymentId,
              paymentMethod: "razorpay",
            },
          });
        } else {
          if (/cancelled by user/i.test(result.message || "")) {
            toast.info("Payment cancelled.");
          } else {
            toast.error(result.message || "Payment was not completed.");
          }
        }
      } catch (error) {
        console.error("Razorpay payment error:", error);
        const errorMessage = error instanceof Error ? error.message : "";

        if (/failed to fetch/i.test(errorMessage)) {
          toast.error("Could not connect to payment service. Please check your internet and try again.");
        } else if (/recaptcha verification is required|security challenge is not configured/i.test(errorMessage)) {
          toast.error("Security check is temporarily unavailable. Please sign in and try again.");
        } else {
          toast.error(
            error instanceof Error
              ? error.message
              : "Payment failed. Please try again."
          );
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Legacy mock flow (card / upi / cod) ─────────────────
    // Show processing modal
    setPaymentModalOpen(true);
    setPaymentModalStatus("processing");
    setPaymentResult({});

    try {
      // Process payment
      const paymentResponse = await processPayment({
        method: paymentMethod,
        amount: total,
        cardDetails: paymentMethod === "card" ? {
          ...cardDetails,
          cardNumber: cardDetails.cardNumber.replace(/\s/g, ""),
        } : undefined,
        upiDetails: paymentMethod === "upi" ? upiDetails : undefined,
      });

      if (paymentResponse.success) {
        // Create the order
        const formData = form.getValues();
        const orderItems = cartItems.map((item) => ({
          productId: item.product.id,
          name: item.product.name,
          qty: item.qty,
          price: item.product.price,
          imageUrl: item.product.image || "",
        }));

        const orderResult = await createOrder({
          items: orderItems,
          customer: {
            name: formData.name,
            email: formData.email.toLowerCase(),
            phone: formData.phone,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            pincode: formData.pincode,
            notes: formData.notes,
          },
          subtotal,
          shipping,
          total,
          couponCode: couponApplied ? couponCode : undefined,
          discount: couponApplied ? discount : undefined,
          payment: {
            ...paymentResponse.paymentInfo,
            status: "pending",
          },
        });

        setPaymentModalStatus("success");
        setPaymentResult({
          transactionId: paymentResponse.transactionId,
          orderNumber: orderResult.orderNumber,
        });

        // Clear cart
        clearCart();
      } else {
        setPaymentModalStatus("failed");
        setPaymentResult({
          errorMessage: paymentResponse.message,
        });
      }
    } catch (error) {
      console.error("Payment/Order error:", error);
      setPaymentModalStatus("failed");
      setPaymentResult({
        errorMessage: "An unexpected error occurred. Please try again.",
      });
    }
  };

  // Handle retry payment
  const handleRetryPayment = () => {
    setPaymentModalOpen(false);
    setPaymentModalStatus("processing");
    setPaymentResult({});
  };

  const handleResendVerification = async () => {
    setResendingVerification(true);
    try {
      await resendVerificationEmail();
      await refreshVerificationStatus();
      toast.success("Verification email sent. Please check your inbox.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to send verification email right now."
      );
    } finally {
      setResendingVerification(false);
    }
  };

  // Handle continue after successful payment
  const handleContinueToConfirmation = () => {
    setPaymentModalOpen(false);
    navigate(`/order-confirmation/${paymentResult.orderNumber}`, {
      state: {
        orderNumber: paymentResult.orderNumber,
        transactionId: paymentResult.transactionId,
        paymentMethod,
        guestCheckout,
        guestEmail: guestCheckout ? form.getValues("email") : undefined,
      },
    });
  };

  // Auth loading view
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Empty cart view
  if (cartItems.length === 0 && !paymentResult.orderNumber) {
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
        {/* Step Indicator */}
        <CheckoutSteps 
          currentStep={currentStep === "address" ? "address" : "payment"} 
          className="mb-8" 
        />

        <div className="mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => currentStep === "payment" ? setCurrentStep("address") : navigate("/cart")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {currentStep === "payment" ? "Back to Address" : "Back to Cart"}
          </Button>
          <h1 className="text-3xl font-bold">
            {currentStep === "address" ? "Shipping Details" : "Payment"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {currentStep === "address" 
              ? "Enter your shipping address to continue." 
              : "Choose a payment method to complete your order."}
          </p>
        </div>

        {!isAuthenticated && guestCheckout && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardContent className="py-4 text-sm">
              You are checking out as a guest. Add an account later from your confirmation page.
            </CardContent>
          </Card>
        )}

        {isAuthenticated && !isEmailVerified && (
          <Card className="mb-6 border-amber-500/40 bg-amber-500/5">
            <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-medium">Email verification required before payment</p>
                <p className="text-sm text-muted-foreground">
                  Verify your account to place this order securely.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleResendVerification}
                disabled={resendingVerification}
              >
                {resendingVerification ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Resend verification"
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          {/* Main Content */}
          <div className="space-y-6">
            {/* Address Step */}
            {currentStep === "address" && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleAddressSubmit)} className="space-y-6">
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
                                <Input
                                  className="pl-10"
                                  type="tel"
                                  inputMode="numeric"
                                  maxLength={13}
                                  placeholder="9876543210"
                                  {...field}
                                  onChange={(event) => {
                                    const digits = event.target.value.replace(/\D/g, "").slice(0, 13);
                                    field.onChange(digits);
                                  }}
                                />
                              </div>
                            </FormControl>
                            <FormDescription>Use 10 to 13 digits.</FormDescription>
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

                  {/* Mobile Continue Button */}
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
                          Validating...
                        </>
                      ) : (
                        <>
                          Continue to Payment
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            {/* Payment Step */}
            {currentStep === "payment" && (
              <div className="space-y-6">
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
                    <PaymentMethodSelector
                      selectedMethod={paymentMethod}
                      onMethodChange={setPaymentMethod}
                      disabled={loading || guestCheckout}
                    />
                  </CardContent>
                </Card>

                {/* Shipping Summary */}
                <Card className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MapPin className="h-4 w-4" />
                      Shipping To
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-sm space-y-1">
                      <p className="font-medium">{form.getValues("name")}</p>
                      <p className="text-muted-foreground">{form.getValues("address")}</p>
                      <p className="text-muted-foreground">
                        {form.getValues("city")}, {form.getValues("state")} - {form.getValues("pincode")}
                      </p>
                      <p className="text-muted-foreground">{form.getValues("phone")}</p>
                    </div>
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="mt-2 h-auto p-0" 
                      onClick={() => setCurrentStep("address")}
                    >
                      Edit Address
                    </Button>
                  </CardContent>
                </Card>

                {/* Mobile Place Order Button */}
                <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg z-50">
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handlePaymentSubmit}
                    disabled={loading || isPaymentBlocked}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="mr-2 h-5 w-5" />
                        Place Order - {formatCurrency(total)}
                      </>
                    )}
                  </Button>
                </div>
                {/* Add padding at bottom for mobile sticky button */}
                <div className="lg:hidden h-24" />
              </div>
            )}
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

                {/* Coupon Section */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Have a coupon code?</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter coupon code"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      disabled={couponApplied}
                      className="flex-1"
                    />
                    {!couponApplied ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleApplyCoupon}
                        disabled={!couponCode.trim()}
                      >
                        Apply
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleRemoveCoupon}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  {couponApplied && (
                    <p className="text-xs text-green-600">
                      ✓ Coupon applied successfully
                    </p>
                  )}
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
                  {discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-green-600">-{formatCurrency(discount)}</span>
                    </div>
                  )}
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
              <CardFooter className="hidden lg:flex flex-col gap-3">
                {currentStep === "address" ? (
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={loading}
                    onClick={form.handleSubmit(handleAddressSubmit)}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      <>
                        Continue to Payment
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                ) : (
                  <>
                    <Button
                      size="lg"
                      className="w-full"
                      onClick={handlePaymentSubmit}
                      disabled={loading || isPaymentBlocked}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="mr-2 h-5 w-5" />
                          Place Order
                        </>
                      )}
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>

            {/* Trust Badges */}
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-center text-xs">
                <div>
                  <Truck className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <span className="text-muted-foreground">Free shipping over ₹999</span>
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

      <CheckoutAuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        onSuccess={() => {
          setAuthModalOpen(false);
        }}
        onContinueGuest={() => {
          enableGuestCheckout();
          setGuestCheckout(true);
          setAuthModalOpen(false);
        }}
      />

      <Footer />

      {/* Payment Processing Modal */}
      <PaymentProcessingModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        status={paymentModalStatus}
        paymentMethod={paymentMethod}
        amount={total}
        transactionId={paymentResult.transactionId}
        errorMessage={paymentResult.errorMessage}
        onRetry={handleRetryPayment}
        onContinue={handleContinueToConfirmation}
      />
    </div>
  );
}
