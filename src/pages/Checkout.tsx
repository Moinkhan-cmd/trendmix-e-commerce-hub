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
  Minus,
  Plus,
  Trash2,
  XCircle,
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
import { checkPincodeServiceability, type ServiceabilityResult } from "@/lib/shiprocket";

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
const COD_MIN_ORDER_TOTAL = 399;
const COD_FEE = 29;
// COD enabled with ₹29 fee. Minimum order ₹399 to reduce fake orders.

type CheckoutStep = "address" | "payment";
type PaymentModalStatus = "processing" | "success" | "failed";

export default function Checkout() {
  const navigate = useNavigate();
  const { cartItems, cartCount, subtotal: cartSubtotal, clearCart, setQty, removeFromCart } = useShop();
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
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentModalStatus, setPaymentModalStatus] = useState<PaymentModalStatus>("processing");
  const [paymentResult, setPaymentResult] = useState<{
    transactionId?: string;
    errorMessage?: string;
    orderNumber?: string;
    amountPaid?: number;
    usedPaymentMethod?: PaymentMethod;
  }>({});
  const [checkoutSummarySnapshot, setCheckoutSummarySnapshot] = useState<{
    items: typeof cartItems;
    cartCount: number;
    subtotal: number;
    shipping: number;
    discount: number;
    codFee: number;
    finalTotal: number;
  } | null>(null);
  
  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [guestCheckout, setGuestCheckout] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  // Pincode serviceability state
  const [pincodeChecking, setPincodeChecking] = useState(false);
  const [pincodeResult, setPincodeResult] = useState<ServiceabilityResult | null>(null);
  const [pincodeChecked, setPincodeChecked] = useState("");

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
  const canUseCod = total >= COD_MIN_ORDER_TOTAL;
  const codFee = paymentMethod === "cod" ? COD_FEE : 0;
  const finalTotal = total + codFee;
  const isPaymentInFlight = paymentModalOpen && paymentModalStatus === "processing";
  const disableCheckoutActions = loading || isSubmittingPayment || isPaymentInFlight;
  const lockSummaryToSnapshot = paymentModalStatus === "success" && checkoutSummarySnapshot !== null;
  const hideCouponSection = isPaymentInFlight || lockSummaryToSnapshot;
  const summaryItems = lockSummaryToSnapshot ? checkoutSummarySnapshot.items : cartItems;
  const summaryCartCount = lockSummaryToSnapshot ? checkoutSummarySnapshot.cartCount : cartCount;
  const summarySubtotal = lockSummaryToSnapshot ? checkoutSummarySnapshot.subtotal : subtotal;
  const summaryShipping = lockSummaryToSnapshot ? checkoutSummarySnapshot.shipping : shipping;
  const summaryDiscount = lockSummaryToSnapshot ? checkoutSummarySnapshot.discount : discount;
  const summaryCodFee = lockSummaryToSnapshot ? checkoutSummarySnapshot.codFee : codFee;
  const summaryFinalTotal = lockSummaryToSnapshot ? checkoutSummarySnapshot.finalTotal : finalTotal;

  useEffect(() => {
    if (!canUseCod && paymentMethod === "cod") {
      setPaymentMethod("razorpay");
    }
  }, [canUseCod, paymentMethod]);

  // Handle coupon code application
  const handleApplyCoupon = () => {
    if (!couponCode.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }

    const validation = validateCouponCode(couponCode.trim(), subtotal + shipping);
    
    if (validation.valid) {
      setDiscount(validation.discount);
      setCouponApplied(true);
      toast.success("Coupon applied! Payable amount set to ₹9");
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
    if (isSubmittingPayment || isPaymentInFlight) {
      return;
    }

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

    // COD enabled with ₹29 fee. Minimum order ₹399 to reduce fake orders.
    if (paymentMethod === "cod" && !canUseCod) {
      toast.error("Cash on Delivery is available only for orders of ₹399 or more.");
      return;
    }

    // Razorpay doesn't need local validation — its own checkout handles that
    if (paymentMethod !== "razorpay") {
      if (!validatePaymentDetails()) {
        toast.error("Please fix the payment details");
        return;
      }
    }

    setIsSubmittingPayment(true);

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
        setIsSubmittingPayment(false);
      }
      return;
    }

    // ── Legacy mock flow (card / upi) ───────────────────────
    // Show processing modal
    setPaymentModalOpen(true);
    setPaymentModalStatus("processing");
    setPaymentResult({});
    setCheckoutSummarySnapshot(null);
    setIsSubmittingPayment(false);

    try {
      // Process payment
      const paymentResponse = await processPayment({
        method: paymentMethod,
      amount: finalTotal,
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
        setCheckoutSummarySnapshot({
          items: cartItems.map((item) => ({
            ...item,
            product: { ...item.product },
          })),
          cartCount,
          subtotal,
          shipping,
          discount,
          codFee,
          finalTotal,
        });
        setPaymentResult({
          transactionId: paymentResponse.transactionId,
          orderNumber: orderResult.orderNumber,
          amountPaid: finalTotal,
          usedPaymentMethod: paymentMethod,
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
    setCheckoutSummarySnapshot(null);
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

        <div className="grid gap-6 lg:gap-8 lg:grid-cols-[1fr_380px]">
          {/* Main Content */}
          <div className="space-y-5">
            <Card className="border-border/60 shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="pb-3 bg-muted/15">
                <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  Cart Items
                </CardTitle>
                <CardDescription className="text-xs">
                  Review or update items before placing your order
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 space-y-2.5">
                {cartItems.map((item) => (
                  <div key={item.product.id} className="rounded-xl border border-border/50 bg-background p-3 hover:shadow-sm transition-shadow">
                    <div className="flex items-start gap-3">
                    <img
                      src={item.product.image || "/placeholder.svg"}
                      alt={item.product.name}
                      className="h-14 w-14 sm:h-16 sm:w-16 object-cover rounded-lg border border-border/40"
                    />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(item.product.price)} each</p>
                      <p className="text-sm font-bold mt-1 text-foreground">
                        {formatCurrency(item.product.price * item.qty)}
                      </p>
                    </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-end gap-1 rounded-lg bg-muted/30 p-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-md"
                        disabled={loading || item.qty <= 1}
                        onClick={() => setQty(item.product.id, Math.max(1, item.qty - 1))}
                        aria-label={`Decrease quantity of ${item.product.name}`}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-7 text-center text-sm font-medium">{item.qty}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-md"
                        disabled={loading}
                        onClick={() => setQty(item.product.id, item.qty + 1)}
                        aria-label={`Increase quantity of ${item.product.name}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-md text-muted-foreground hover:text-destructive"
                        disabled={loading}
                        onClick={() => removeFromCart(item.product.id)}
                        aria-label={`Remove ${item.product.name} from cart`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Address Step */}
            {currentStep === "address" && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleAddressSubmit)} className="space-y-6">
                  {/* Contact Information */}
                  <Card className="border-border/60 shadow-sm rounded-xl overflow-hidden">
                    <CardHeader className="bg-muted/15 pb-3">
                      <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
                        <User className="h-4 w-4 text-primary" />
                        Contact Information
                      </CardTitle>
                      <CardDescription className="text-xs">
                        We’ll use this to send order updates
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
                  <Card className="border-border/60 shadow-sm rounded-xl overflow-hidden">
                    <CardHeader className="bg-muted/15 pb-3">
                      <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
                        <MapPin className="h-4 w-4 text-primary" />
                        Shipping Address
                      </CardTitle>
                      <CardDescription className="text-xs">
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
                              <div className="flex gap-2">
                                <Input
                                  placeholder="400001"
                                  {...field}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    // Reset result when pincode changes
                                    if (e.target.value !== pincodeChecked) {
                                      setPincodeResult(null);
                                    }
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={pincodeChecking || !/^\d{6}$/.test(field.value)}
                                  className="shrink-0"
                                  onClick={async () => {
                                    if (!/^\d{6}$/.test(field.value)) return;
                                    setPincodeChecking(true);
                                    setPincodeResult(null);
                                    try {
                                      const result = await checkPincodeServiceability(
                                        field.value,
                                        0.5,
                                        paymentMethod === "cod"
                                      );
                                      setPincodeResult(result);
                                      setPincodeChecked(field.value);
                                      if (!result.is_serviceable) {
                                        toast.error("Delivery not available at this pincode");
                                      }
                                    } catch (err) {
                                      toast.error(err instanceof Error ? err.message : "Serviceability check failed");
                                    } finally {
                                      setPincodeChecking(false);
                                    }
                                  }}
                                >
                                  {pincodeChecking ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Check"
                                  )}
                                </Button>
                              </div>
                            </FormControl>
                            <FormMessage />
                            {/* Serviceability result */}
                            {pincodeResult && (
                              <div className={`text-sm mt-1.5 p-2.5 rounded-md ${
                                pincodeResult.is_serviceable
                                  ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                                  : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                              }`}>
                                {pincodeResult.is_serviceable ? (
                                  <>
                                    <p className="flex items-center gap-1.5 font-medium">
                                      <CheckCircle className="h-3.5 w-3.5" />
                                      Delivery available!
                                    </p>
                                    {pincodeResult.estimated_delivery_days && (
                                      <p className="text-xs mt-0.5">
                                        Estimated delivery: {pincodeResult.estimated_delivery_days} day{pincodeResult.estimated_delivery_days !== 1 ? "s" : ""}
                                      </p>
                                    )}
                                    {pincodeResult.cod_available && (
                                      <p className="text-xs mt-0.5">Cash on Delivery available</p>
                                    )}
                                  </>
                                ) : (
                                  <p className="flex items-center gap-1.5 font-medium">
                                    <XCircle className="h-3.5 w-3.5" />
                                    Delivery not available at this pincode
                                  </p>
                                )}
                              </div>
                            )}
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
                <Card className="border-border/60 shadow-sm rounded-xl overflow-hidden">
                  <CardHeader className="bg-muted/15 pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
                      <CreditCard className="h-4 w-4 text-primary" />
                      Payment Method
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Choose how you’d like to pay
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PaymentMethodSelector
                      selectedMethod={paymentMethod}
                      onMethodChange={setPaymentMethod}
                      showCod={canUseCod}
                      disabled={disableCheckoutActions || guestCheckout}
                    />
                    {!canUseCod && (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Cash on Delivery is available for orders of ₹{COD_MIN_ORDER_TOTAL} or more.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Shipping Summary */}
                <Card className="border-border/60 shadow-sm rounded-xl overflow-hidden bg-muted/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
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
                    disabled={disableCheckoutActions || isPaymentBlocked}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="mr-2 h-5 w-5" />
                        Place Order - {formatCurrency(finalTotal)}
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
            <Card className="border-border/60 shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="bg-muted/15 pb-3">
                <CardTitle className="text-base font-semibold tracking-tight">Order Summary</CardTitle>
                <CardDescription className="text-xs">
                  {summaryCartCount} item{summaryCartCount !== 1 ? "s" : ""} in your cart
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Cart Snapshot (desktop only) */}
                <div className="hidden lg:block space-y-2 max-h-[200px] overflow-y-auto rounded-lg border border-border/50 bg-muted/10 p-3">
                  {summaryItems.slice(0, 4).map((item) => (
                    <div key={item.product.id} className="flex items-start justify-between text-sm gap-3">
                      <p className="text-foreground leading-snug line-clamp-1 flex-1">
                        {item.product.name} <span className="text-muted-foreground">× {item.qty}</span>
                      </p>
                      <span className="font-semibold whitespace-nowrap text-foreground">{formatCurrency(item.product.price * item.qty)}</span>
                    </div>
                  ))}
                  {summaryItems.length > 4 && (
                    <p className="text-xs text-muted-foreground">
                      +{summaryItems.length - 4} more item{summaryItems.length - 4 > 1 ? "s" : ""}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground/60 border-t border-border/40 pt-2">
                    Edit items from the Cart Items section on the left
                  </p>
                </div>

                {!hideCouponSection ? (
                  <>
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
                  </>
                ) : (
                  <Separator />
                )}

                {/* Totals */}
                <div className="space-y-2 rounded-lg border border-border/50 bg-muted/10 p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{formatCurrency(summarySubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="font-medium">
                      {summaryShipping === 0 ? (
                        <span className="text-green-600 dark:text-green-400">Free</span>
                      ) : (
                        formatCurrency(summaryShipping)
                      )}
                    </span>
                  </div>
                  {summaryDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-green-600 dark:text-green-400 font-medium">-{formatCurrency(summaryDiscount)}</span>
                    </div>
                  )}
                  {summaryCodFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">COD Fee</span>
                      <span className="font-medium">{formatCurrency(summaryCodFee)}</span>
                    </div>
                  )}
                  {summarySubtotal < SHIPPING_THRESHOLD && (
                    <p className="text-[10px] text-muted-foreground/70 pt-0.5">
                      Add {formatCurrency(SHIPPING_THRESHOLD - summarySubtotal)} more for free shipping
                    </p>
                  )}
                </div>
                <div className="flex justify-between items-center rounded-lg bg-primary/5 border border-primary/10 px-3 py-2.5">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold">{formatCurrency(summaryFinalTotal)}</span>
                </div>
              </CardContent>
              <CardFooter className="hidden lg:flex flex-col gap-3 p-4 pt-0">
                {currentStep === "address" ? (
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full rounded-lg font-medium"
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
                      className="w-full rounded-lg font-medium"
                      onClick={handlePaymentSubmit}
                      disabled={disableCheckoutActions || isPaymentBlocked}
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
            <div className="mt-3 rounded-xl border border-border/40 bg-muted/20 p-3">
              <div className="flex items-center justify-center gap-6 text-center text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-primary" />
                  <span>Free shipping over ₹999</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-primary" />
                  <span>Secure checkout</span>
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
        paymentMethod={paymentResult.usedPaymentMethod ?? paymentMethod}
        amount={paymentResult.amountPaid ?? finalTotal}
        transactionId={paymentResult.transactionId}
        errorMessage={paymentResult.errorMessage}
        onRetry={handleRetryPayment}
        onContinue={handleContinueToConfirmation}
      />
    </div>
  );
}
