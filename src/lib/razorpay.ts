/**
 * Razorpay Payment Service (Frontend)
 *
 * Calls Firebase Cloud Functions to:
 *   1. Create a Razorpay order (server-side)
 *   2. Open the Razorpay Checkout modal
 *   3. Verify payment signature (server-side)
 *
 * ⚠️  The Razorpay KEY_SECRET is NEVER exposed here.
 *     Only the KEY_ID (public) is returned by the Cloud Function.
 */

import { auth } from "./firebase";

// ─── Types ──────────────────────────────────────────────────
export interface RazorpayOrderResponse {
  success: boolean;
  order: {
    id: string;
    amount: number;
    currency: string;
  };
  key: string; // Razorpay Key ID (public)
}

export interface RazorpayPaymentResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayVerifyResponse {
  success: boolean;
  message: string;
  paymentId: string;
  orderId?: string;
  orderNumber?: string;
}

export interface RazorpayCheckoutOptions {
  recaptchaToken: string;
  guestCheckout?: boolean;
  guestEmail?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  orderDetails: {
    items: Array<{
      productId: string;
      qty: number;
    }>;
    couponCode?: string;
    customer: {
      name: string;
      email: string;
      phone: string;
      address: string;
      city: string;
      state: string;
      pincode: string;
      notes?: string;
    };
  };
}

// Razorpay Checkout window type
interface RazorpayCheckoutInstance {
  open(): void;
  close(): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
}

interface RazorpayCheckoutConstructor {
  new (options: Record<string, unknown>): RazorpayCheckoutInstance;
}

declare global {
  interface Window {
    Razorpay: RazorpayCheckoutConstructor;
  }
}

// ─── Cloud Function URLs ────────────────────────────────────
// After deploying, these will be something like:
//   https://us-central1-trendmix-admin.cloudfunctions.net/createRazorpayOrder
//
// For local development with emulators:
//   http://127.0.0.1:5001/trendmix-admin/us-central1/createRazorpayOrder

const FUNCTIONS_BASE_URL = import.meta.env.VITE_FIREBASE_FUNCTIONS_URL
  || "https://us-central1-trendmix-admin.cloudfunctions.net";

const CREATE_ORDER_URL = `${FUNCTIONS_BASE_URL}/createRazorpayOrder`;
const VERIFY_PAYMENT_URL = `${FUNCTIONS_BASE_URL}/verifyRazorpayPayment`;
const CREATE_GUEST_ORDER_URL = `${FUNCTIONS_BASE_URL}/createGuestRazorpayOrder`;
const VERIFY_GUEST_PAYMENT_URL = `${FUNCTIONS_BASE_URL}/verifyGuestRazorpayPayment`;

// ─── Helpers ────────────────────────────────────────────────
async function getAuthToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User is not authenticated. Please log in to continue.");
  }
  return user.getIdToken();
}

async function maybeGetAuthToken(guestCheckout?: boolean): Promise<string | null> {
  if (guestCheckout) return null;
  return getAuthToken();
}

function ensureRazorpayLoaded(): void {
  if (typeof window.Razorpay === "undefined") {
    throw new Error(
      "Razorpay SDK not loaded. Make sure the Razorpay script is included in index.html."
    );
  }
}

// ─── Step 1: Create Razorpay Order via Cloud Function ───────
async function createRazorpayOrder(
  recaptchaToken: string,
  orderDetails: RazorpayCheckoutOptions["orderDetails"],
  guestCheckout?: boolean,
  guestEmail?: string
): Promise<RazorpayOrderResponse> {
  const token = await maybeGetAuthToken(guestCheckout);
  const endpoint = guestCheckout ? CREATE_GUEST_ORDER_URL : CREATE_ORDER_URL;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ recaptchaToken, orderDetails, guestEmail }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to create order (HTTP ${response.status})`);
  }

  return response.json();
}

// ─── Step 2: Verify Payment via Cloud Function ──────────────
async function verifyRazorpayPayment(
  paymentResult: RazorpayPaymentResult,
  guestCheckout?: boolean,
  guestEmail?: string
): Promise<RazorpayVerifyResponse> {
  const token = await maybeGetAuthToken(guestCheckout);
  const endpoint = guestCheckout ? VERIFY_GUEST_PAYMENT_URL : VERIFY_PAYMENT_URL;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      ...paymentResult,
      guestEmail,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Payment verification failed (HTTP ${response.status})`);
  }

  return response.json();
}

// ─── Main: Complete Razorpay Checkout Flow ──────────────────
/**
 * Initiates the full Razorpay payment flow:
 *   1. Creates an order on the server
 *   2. Opens the Razorpay Checkout modal
 *   3. On success, verifies the payment on the server
 *   4. Returns the verified result
 *
 * @param options - Payment options (amount in paise, customer info, etc.)
 * @returns Promise that resolves with payment/verification result
 */
export async function initiateRazorpayPayment(
  options: RazorpayCheckoutOptions
): Promise<{
  success: boolean;
  paymentId?: string;
  orderId?: string;
  verificationPending?: boolean;
  message: string;
}> {
  ensureRazorpayLoaded();

  // Step 1: Create order on server
  const orderResponse = await createRazorpayOrder(
    options.recaptchaToken,
    options.orderDetails,
    options.guestCheckout,
    options.guestEmail
  );

  // Step 2: Open Razorpay Checkout
  return new Promise((resolve, reject) => {
    let isSettled = false;
    let isPaymentInProgress = false;

    const settleResolve = (value: {
      success: boolean;
      paymentId?: string;
      orderId?: string;
      verificationPending?: boolean;
      message: string;
    }) => {
      if (isSettled) return;
      isSettled = true;
      resolve(value);
    };

    const settleReject = (error: unknown) => {
      if (isSettled) return;
      isSettled = true;
      reject(error);
    };

    const razorpayOptions: Record<string, unknown> = {
      key: orderResponse.key, // Public Key ID from server
      amount: orderResponse.order.amount,
      currency: orderResponse.order.currency,
      name: "TrendMix Store",
      description: "Purchase from TrendMix Store",
      order_id: orderResponse.order.id,
      prefill: {
        name: options.customerName || "",
        email: options.customerEmail || "",
        contact: options.customerPhone || "",
      },
      theme: {
        color: "#6366f1", // Indigo – matches a common Tailwind primary
      },
      handler: async (response: RazorpayPaymentResult) => {
        isPaymentInProgress = true;
        try {
          // Step 3: Verify payment signature on server
          const verification = await verifyRazorpayPayment(
            response,
            options.guestCheckout,
            options.guestEmail
          );

          settleResolve({
            success: true,
            paymentId: response.razorpay_payment_id,
            orderId: verification.orderId || response.razorpay_order_id,
            orderNumber: verification.orderNumber,
            message: verification.message,
          });
        } catch (verifyError) {
          if (verifyError instanceof Error && /failed to fetch/i.test(verifyError.message)) {
            settleResolve({
              success: true,
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              verificationPending: true,
              message: "Payment received. Verification is pending due to a temporary network issue.",
            });
            return;
          }
          settleReject(verifyError);
        }
      },
      modal: {
        ondismiss: () => {
          if (isPaymentInProgress) return;
          settleResolve({
            success: false,
            message: "Payment cancelled by user",
          });
        },
        escape: true,
        confirm_close: true,
      },
    };

    const rzp = new window.Razorpay(razorpayOptions);

    rzp.on("payment.failed", (failResponse: unknown) => {
      const resp = failResponse as {
        error?: {
          description?: string;
          reason?: string;
        };
      };
      settleResolve({
        success: false,
        message: resp?.error?.description || "Payment failed. Please try again.",
      });
    });

    rzp.open();
  });
}
