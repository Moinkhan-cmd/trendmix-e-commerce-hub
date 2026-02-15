import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Razorpay from "razorpay";
import * as crypto from "crypto";
import cors from "cors";
import sgMail from "@sendgrid/mail";
import { defineSecret, defineString } from "firebase-functions/params";

// ─── Firebase Admin Init ────────────────────────────────────
admin.initializeApp();
const db = admin.firestore();

const SENDGRID_KEY = defineSecret("SENDGRID_KEY");
const SENDGRID_FROM_EMAIL = defineString("SENDGRID_FROM_EMAIL", { default: "" });
const SENDGRID_FROM_NAME = defineString("SENDGRID_FROM_NAME", { default: "TrendMix" });
const SENDGRID_ADMIN_EMAIL = defineString("SENDGRID_ADMIN_EMAIL", { default: "" });

// ─── CORS (allow your frontend origins) ─────────────────────
const corsHandler = cors({
  origin: true, // In production, restrict to your domain(s)
});

function normalizeText(value: unknown, maxLength = 200): string {
  if (typeof value !== "string") return "";
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeEmail(value: unknown): string {
  return normalizeText(value, 254).toLowerCase();
}

function formatInr(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "₹0.00";
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type ParsedOrderEmailContext = {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  itemsText: string;
  totalText: string;
  statusText: string;
  trackingNumber: string;
  shippingCarrier: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentId: string;
};

type OutgoingEmail = {
  subject: string;
  text: string;
};

function parseOrderEmailContext(orderData: Record<string, unknown>, orderId: string): ParsedOrderEmailContext {
  const payment = (orderData.payment ?? {}) as Record<string, unknown>;
  const customer = (orderData.customer ?? {}) as Record<string, unknown>;
  const items = Array.isArray(orderData.items) ? orderData.items : [];

  const orderNumber = normalizeText(orderData.orderNumber, 80) || orderId;
  const customerName = normalizeText(customer.name, 120) || "Customer";
  const customerEmail = normalizeEmail(customer.email);
  const customerPhone = normalizeText(customer.phone, 30) || "N/A";
  const statusText = normalizeText(orderData.status, 40) || "Pending";
  const trackingNumber = normalizeText(orderData.trackingNumber, 120) || "N/A";
  const shippingCarrier = normalizeText(orderData.shippingCarrier, 80) || "Standard";

  const paymentMethod = normalizeText(payment.method, 40) || "N/A";
  const paymentStatus = normalizeText(payment.status, 40) || "N/A";
  const paymentId = normalizeText(payment.transactionId, 120) || "N/A";

  const address = [
    normalizeText(customer.address, 250),
    normalizeText(customer.city, 80),
    normalizeText(customer.state, 80),
    normalizeText(customer.pincode, 20),
  ]
    .filter(Boolean)
    .join(", ") || "N/A";

  const itemsText = items
    .map((entry) => {
      const item = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
      const itemName = normalizeText(item.name, 160) || "Item";
      const qty = Number(item.qty ?? 1);
      const price = Number(item.price ?? 0);
      const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
      return `• ${itemName} x${safeQty} (${formatInr(price)})`;
    })
    .join("\n") || "N/A";

  return {
    orderNumber,
    customerName,
    customerEmail,
    customerPhone,
    address,
    itemsText,
    totalText: formatInr(orderData.total),
    statusText,
    trackingNumber,
    shippingCarrier,
    paymentMethod,
    paymentStatus,
    paymentId,
  };
}

function buildAdminNewOrderEmail(orderId: string, ctx: ParsedOrderEmailContext): OutgoingEmail {
  return {
    subject: `New order placed: ${ctx.orderNumber}`,
    text: [
      "New order placed",
      `Order ID: ${orderId}`,
      `Order Number: ${ctx.orderNumber}`,
      `Customer Name: ${ctx.customerName}`,
      `Customer Email: ${ctx.customerEmail || "N/A"}`,
      `Phone: ${ctx.customerPhone}`,
      "Products:",
      ctx.itemsText,
      `Total: ${ctx.totalText}`,
      `Payment Method: ${ctx.paymentMethod}`,
      `Payment Status: ${ctx.paymentStatus}`,
      `Payment ID: ${ctx.paymentId}`,
      `Delivery Address: ${ctx.address}`,
    ].join("\n"),
  };
}

function buildCustomerOrderPlacedEmail(orderId: string, ctx: ParsedOrderEmailContext): OutgoingEmail {
  return {
    subject: `Thank you for your order ${ctx.orderNumber}`,
    text: [
      `Hi ${ctx.customerName},`,
      "",
      "Thank you for shopping with TrendMix. Your order has been placed successfully.",
      "",
      `Order Number: ${ctx.orderNumber}`,
      `Order ID: ${orderId}`,
      `Order Status: ${ctx.statusText}`,
      "",
      "Items:",
      ctx.itemsText,
      "",
      `Order Total: ${ctx.totalText}`,
      `Delivery Address: ${ctx.address}`,
      "",
      "We will send you another update when your order is shipped.",
      "",
      "Thanks,",
      "TrendMix Team",
    ].join("\n"),
  };
}

function buildCustomerShippedEmail(orderId: string, ctx: ParsedOrderEmailContext): OutgoingEmail {
  return {
    subject: `Your order ${ctx.orderNumber} has been shipped`,
    text: [
      `Hi ${ctx.customerName},`,
      "",
      "Great news! Your TrendMix order has been shipped.",
      "",
      `Order Number: ${ctx.orderNumber}`,
      `Order ID: ${orderId}`,
      `Current Status: ${ctx.statusText}`,
      `Shipping Carrier: ${ctx.shippingCarrier}`,
      `Tracking Number: ${ctx.trackingNumber}`,
      "",
      `Order Total: ${ctx.totalText}`,
      "",
      "Thanks,",
      "TrendMix Team",
    ].join("\n"),
  };
}

function buildCustomerDeliveredEmail(orderId: string, ctx: ParsedOrderEmailContext): OutgoingEmail {
  return {
    subject: `Order delivered: ${ctx.orderNumber}`,
    text: [
      `Hi ${ctx.customerName},`,
      "",
      "Your order has been delivered successfully. Thank you for shopping with TrendMix.",
      "",
      `Order Number: ${ctx.orderNumber}`,
      `Order ID: ${orderId}`,
      `Current Status: ${ctx.statusText}`,
      "",
      "Items:",
      ctx.itemsText,
      "",
      `Order Total: ${ctx.totalText}`,
      "",
      "We hope to see you again soon!",
      "",
      "Thanks,",
      "TrendMix Team",
    ].join("\n"),
  };
}

// ─── Razorpay Instance ──────────────────────────────────────
// Credentials are loaded from functions/.env (see .env.example)
function getRazorpayInstance(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim().replace(/^"|"$/g, "");
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim().replace(/^"|"$/g, "");

  const hasPlaceholders =
    (keyId ?? "").includes("PASTE_YOUR_KEY_ID_HERE") ||
    (keySecret ?? "").includes("PASTE_YOUR_SECRET_KEY_HERE");

  if (!keyId || !keySecret || hasPlaceholders) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Razorpay credentials are not configured. Set real RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in functions/.env and redeploy functions."
    );
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

// ═════════════════════════════════════════════════════════════
// Cloud Function 1: createRazorpayOrder
// ═════════════════════════════════════════════════════════════
// Creates a Razorpay order on the server side.
// Frontend calls this to get an order_id before opening checkout.
// ═════════════════════════════════════════════════════════════
export const createRazorpayOrder = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Method not allowed" });
        return;
      }

      const decodedToken = await verifyAuthenticatedUser(req);
      const userId = decodedToken.uid;
      const userEmail = decodedToken.email ?? "";
      const clientIp = getClientIp(req);

      const body = req.body as {
        recaptchaToken?: string;
        amount?: unknown;
        currency?: unknown;
        receipt?: unknown;
        orderDetails?: {
          items?: unknown;
          couponCode?: unknown;
          customer?: unknown;
        };
      };

      const hasLegacyAmount = body.amount !== undefined && body.amount !== null;
      let recaptchaScore = 0;
      let calculatedOrder: CalculatedOrder | null = null;
      let amountInPaise = 0;

      if (hasLegacyAmount) {
        const parsedAmount = Number(body.amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
          throw new functions.https.HttpsError(
            "invalid-argument",
            "Invalid amount. Must be a positive number (in paise)."
          );
        }
        amountInPaise = Math.round(parsedAmount);
      } else {
        const recaptchaToken = normalizeText(body.recaptchaToken, 4096);
        if (!recaptchaToken) {
          throw new functions.https.HttpsError("invalid-argument", "reCAPTCHA verification is required.");
        }

        const recaptcha = shouldBypassRecaptcha(req, recaptchaToken, "checkout")
          ? { success: true, score: 1, action: "checkout" }
          : await verifyRecaptchaToken(recaptchaToken, "checkout", clientIp);
        if (!recaptcha.success) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "Security verification failed. Please refresh and try again."
          );
        }
        recaptchaScore = recaptcha.score;

        const rawItems = body.orderDetails?.items;
        const rawCustomer = body.orderDetails?.customer;

        const sanitizedCustomer = sanitizeCustomer(rawCustomer);
        if (sanitizedCustomer.email !== normalizeEmail(userEmail)) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "Checkout email must match the authenticated account email."
          );
        }

        const sanitizedItems = sanitizeItems(rawItems);
        calculatedOrder = await calculateCanonicalOrder(
          sanitizedItems,
          sanitizedCustomer,
          body.orderDetails?.couponCode
        );
        amountInPaise = Math.round(calculatedOrder.total * 100);
      }

      if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Invalid amount. Must be a positive number (in paise)."
        );
      }

      const razorpay = getRazorpayInstance();
      const orderOptions = {
        amount: amountInPaise,
        currency: normalizeText(body.currency, 8) || "INR",
        receipt: normalizeText(body.receipt, 40) || `tm_${Date.now()}_${userId.slice(0, 6)}`,
        notes: {
          userId,
          recaptchaScore: recaptchaScore.toFixed(2),
          mode: hasLegacyAmount ? "legacy" : "secure",
        },
      };

      let order;
      try {
        order = await razorpay.orders.create(orderOptions);
      } catch (rzpError: unknown) {
        const err = rzpError as { statusCode?: number; error?: { description?: string } };
        if (err.statusCode === 401) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Payment gateway authentication failed. Please contact support."
          );
        }
        throw rzpError;
      }

      await db.collection("razorpay_orders").doc(order.id).set({
        userId,
        userEmail: normalizeEmail(userEmail),
        razorpay_order_id: order.id,
        amount: amountInPaise,
        currency: orderOptions.currency,
        receipt: orderOptions.receipt,
        status: "created",
        recaptchaScore,
        mode: hasLegacyAmount ? "legacy" : "secure",
        calculatedOrder,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).json({
        success: true,
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
        },
        key: process.env.RAZORPAY_KEY_ID,
      });
    } catch (error: unknown) {
      console.error("createRazorpayOrder error:", error);
      sendError(res, error);
    }
  });
});

// ═════════════════════════════════════════════════════════════
// Cloud Function: createGuestRazorpayOrder
// ═════════════════════════════════════════════════════════════
// Allows guest checkout intent creation without auth.
// Still validates reCAPTCHA, canonical order pricing, and applies rate limits.
// ═════════════════════════════════════════════════════════════
export const createGuestRazorpayOrder = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Method not allowed" });
        return;
      }

      const body = req.body as {
        recaptchaToken?: unknown;
        guestEmail?: unknown;
        orderDetails?: {
          items?: unknown;
          couponCode?: unknown;
          customer?: unknown;
        };
      };

      const clientIp = getClientIp(req);
      const recaptchaToken = normalizeText(body.recaptchaToken, 4096);
      if (!recaptchaToken) {
        throw new functions.https.HttpsError("invalid-argument", "reCAPTCHA verification is required.");
      }

      const recaptcha = shouldBypassRecaptcha(req, recaptchaToken, "checkout")
        ? { success: true, score: 1, action: "checkout" }
        : await verifyRecaptchaToken(recaptchaToken, "checkout", clientIp);
      if (!recaptcha.success) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Security verification failed. Please refresh and try again."
        );
      }

      const guestEmail = ensureValidEmail(body.guestEmail, "A valid guest email is required.");
      await checkRateLimit(`guest_checkout_${clientIp}_${guestEmail}`, 300, 5);

      const sanitizedCustomer = sanitizeCustomer(body.orderDetails?.customer);
      if (sanitizedCustomer.email !== guestEmail) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Checkout email must match the guest email."
        );
      }

      const sanitizedItems = sanitizeItems(body.orderDetails?.items);
      const calculatedOrder = await calculateCanonicalOrder(
        sanitizedItems,
        sanitizedCustomer,
        body.orderDetails?.couponCode
      );
      const amountInPaise = Math.round(calculatedOrder.total * 100);

      if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Invalid amount. Must be a positive number (in paise)."
        );
      }

      const razorpay = getRazorpayInstance();
      const receipt = `tm_guest_${Date.now()}`;
      const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt,
        notes: {
          mode: "guest",
          guestEmail,
          recaptchaScore: recaptcha.score.toFixed(2),
        },
      });

      await db.collection("razorpay_orders").doc(order.id).set({
        userId: null,
        userEmail: null,
        guestEmail,
        razorpay_order_id: order.id,
        amount: amountInPaise,
        currency: "INR",
        receipt,
        status: "created",
        recaptchaScore: recaptcha.score,
        mode: "guest",
        calculatedOrder,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await db.collection("guest_checkout_intents").add({
        guestEmail,
        razorpay_order_id: order.id,
        status: "created",
        total: calculatedOrder.total,
        currency: "INR",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).json({
        success: true,
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
        },
        key: process.env.RAZORPAY_KEY_ID,
      });
    } catch (error: unknown) {
      console.error("createGuestRazorpayOrder error:", error);
      sendError(res, error);
    }
  });
});

// ═════════════════════════════════════════════════════════════
// Cloud Function 2: verifyRazorpayPayment
// ═════════════════════════════════════════════════════════════
// After user completes payment on the frontend, this function:
//   1. Verifies the Razorpay signature (HMAC SHA256)
//   2. Stores the confirmed order in Firestore
// ═════════════════════════════════════════════════════════════
export const verifyRazorpayPayment = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Method not allowed" });
        return;
      }

      const decodedToken = await verifyAuthenticatedUser(req);
      const userId = decodedToken.uid;
      const userEmail = normalizeEmail(decodedToken.email ?? "");

      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Missing required payment verification fields."
        );
      }

      // ── Verify Signature ──────────────────────────────────
      const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim().replace(/^"|"$/g, "");
      if (!keySecret) {
        throw new functions.https.HttpsError("failed-precondition", "Razorpay secret is not configured.");
      }

      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(body)
        .digest("hex");

      if (!safeCompareHex(expectedSignature, razorpay_signature)) {
        await db.collection("razorpay_orders").doc(String(razorpay_order_id)).set(
          {
            status: "signature_failed",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        throw new functions.https.HttpsError(
          "permission-denied",
          "Payment verification failed. Please contact support if amount was deducted."
        );
      }

      const razorpayOrderRef = db.collection("razorpay_orders").doc(String(razorpay_order_id));
      const orderSnap = await razorpayOrderRef.get();
      if (!orderSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Payment order not found.");
      }

      const orderData = orderSnap.data() as {
        userId?: string;
        userEmail?: string;
        status?: string;
        amount?: number;
        calculatedOrder?: CalculatedOrder;
        orderId?: string;
        orderNumber?: string;
      };

      if (orderData.userId !== userId || normalizeEmail(orderData.userEmail ?? "") !== userEmail) {
        throw new functions.https.HttpsError("permission-denied", "You are not allowed to verify this payment.");
      }

      if (!orderData.calculatedOrder) {
        await razorpayOrderRef.set(
          {
            status: "paid",
            razorpay_payment_id: String(razorpay_payment_id),
            razorpay_signature: String(razorpay_signature),
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        await db.collection("payments").doc(String(razorpay_payment_id)).set({
          userId,
          userEmail,
          amount: typeof orderData.amount === "number" ? orderData.amount : null,
          razorpay_order_id: String(razorpay_order_id),
          razorpay_payment_id: String(razorpay_payment_id),
          status: "Paid",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        res.status(200).json({
          success: true,
          message: "Payment verified successfully.",
          paymentId: String(razorpay_payment_id),
          orderId: null,
          orderNumber: null,
        });
        return;
      }
      const calculatedOrder = orderData.calculatedOrder;

      if (orderData.status === "paid" && orderData.orderNumber) {
        res.status(200).json({
          success: true,
          message: "Payment already verified.",
          paymentId: razorpay_payment_id,
          orderNumber: orderData.orderNumber,
          orderId: orderData.orderId ?? null,
        });
        return;
      }

      if (typeof orderData.amount === "number") {
        const calculatedPaise = Math.round(calculatedOrder.total * 100);
        if (calculatedPaise !== Math.round(orderData.amount)) {
          throw new functions.https.HttpsError("failed-precondition", "Order amount mismatch detected.");
        }
      }

      const orderNumber = generateOrderNumber();
      const orderRef = db.collection("orders").doc();

      await db.runTransaction(async (tx) => {
        const latestSnap = await tx.get(razorpayOrderRef);
        const latestData = latestSnap.data() as { status?: string } | undefined;
        if (!latestSnap.exists) {
          throw new functions.https.HttpsError("not-found", "Payment order not found.");
        }
        if (latestData?.status === "paid") {
          return;
        }

        tx.set(orderRef, {
          items: calculatedOrder.items,
          customer: calculatedOrder.customer,
          status: "Pending",
          subtotal: calculatedOrder.subtotal,
          shipping: calculatedOrder.shipping,
          discount: calculatedOrder.discount,
          total: calculatedOrder.total,
          orderNumber,
          userId,
          timeline: createOrderTimelineNote(String(razorpay_payment_id)),
          payment: {
            method: "online",
            status: "completed",
            transactionId: String(razorpay_payment_id),
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          emailSent: false,
          customerEmailSent: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        tx.set(
          razorpayOrderRef,
          {
            status: "paid",
            razorpay_payment_id: String(razorpay_payment_id),
            razorpay_signature: String(razorpay_signature),
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            orderId: orderRef.id,
            orderNumber,
          },
          { merge: true }
        );

        tx.set(db.collection("payments").doc(String(razorpay_payment_id)), {
          userId,
          userEmail,
          amount: orderData.amount ?? Math.round(calculatedOrder.total * 100),
          razorpay_order_id: String(razorpay_order_id),
          razorpay_payment_id: String(razorpay_payment_id),
          status: "Paid",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      });

      res.status(200).json({
        success: true,
        message: "Payment verified successfully.",
        paymentId: String(razorpay_payment_id),
        orderId: orderRef.id,
        orderNumber,
      });
    } catch (error: unknown) {
      console.error("verifyRazorpayPayment error:", error);
      sendError(res, error);
    }
  });
});

export const onOrderCreatedSendEmailNotifications = functions
  .runWith({ secrets: [SENDGRID_KEY] })
  .firestore
  .document("orders/{orderId}")
  .onCreate(async (snapshot, context) => {
    const orderId = String(context.params.orderId ?? snapshot.id);
    const orderData = snapshot.data() as Record<string, unknown>;

    const settingsSnap = await db.collection("settings").doc("notifications").get();
    const settingsData = settingsSnap.exists ? (settingsSnap.data() as Record<string, unknown>) : {};

    const shouldSendAdminEmail = orderData.emailSent !== true && settingsData.notifyOnNewOrder !== false;
    const shouldSendCustomerConfirmation =
      orderData.customerEmailSent !== true && settingsData.sendCustomerConfirmation !== false;

    if (!shouldSendAdminEmail && !shouldSendCustomerConfirmation) {
      return null;
    }

    const apiKey = normalizeText(SENDGRID_KEY.value(), 5000);
    const fromEmail = normalizeEmail(SENDGRID_FROM_EMAIL.value());
    const fromName = normalizeText(SENDGRID_FROM_NAME.value(), 120) || "TrendMix";
    const adminEmail = normalizeEmail(settingsData.adminEmail ?? SENDGRID_ADMIN_EMAIL.value());

    if (!apiKey || !fromEmail) {
      console.error("SendGrid configuration missing for order notifications", { orderId });
      return null;
    }

    const parsed = parseOrderEmailContext(orderData, orderId);

    sgMail.setApiKey(apiKey);

    const updatePayload: Record<string, unknown> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (shouldSendAdminEmail && adminEmail) {
      try {
        const adminEmailBody = buildAdminNewOrderEmail(orderId, parsed);
        await sgMail.send({
          to: adminEmail,
          from: {
            email: fromEmail,
            name: fromName,
          },
          subject: adminEmailBody.subject,
          text: adminEmailBody.text,
        });
        updatePayload.emailSent = true;
      } catch (error) {
        console.error("Failed to send admin order notification", {
          orderId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    if (shouldSendCustomerConfirmation && parsed.customerEmail) {
      try {
        const customerEmailBody = buildCustomerOrderPlacedEmail(orderId, parsed);
        await sgMail.send({
          to: parsed.customerEmail,
          from: {
            email: fromEmail,
            name: fromName,
          },
          subject: customerEmailBody.subject,
          text: customerEmailBody.text,
        });
        updatePayload.customerEmailSent = true;
      } catch (error) {
        console.error("Failed to send customer order confirmation", {
          orderId,
          customerEmail: parsed.customerEmail,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    if (Object.keys(updatePayload).length > 1) {
      await snapshot.ref.set(updatePayload, { merge: true });
    }

    return null;
  });

export const onOrderStatusChangedSendCustomerEmail = functions
  .runWith({ secrets: [SENDGRID_KEY] })
  .firestore
  .document("orders/{orderId}")
  .onUpdate(async (change, context) => {
    const orderId = String(context.params.orderId ?? change.after.id);
    const beforeData = change.before.data() as Record<string, unknown>;
    const afterData = change.after.data() as Record<string, unknown>;

    const previousStatus = normalizeText(beforeData.status, 40);
    const currentStatus = normalizeText(afterData.status, 40);

    if (!currentStatus || currentStatus === previousStatus) {
      return null;
    }

    const shouldHandleStatus = currentStatus === "Shipped" || currentStatus === "Delivered";
    if (!shouldHandleStatus) {
      return null;
    }

    const statusEmails =
      (typeof afterData.customerStatusEmails === "object" && afterData.customerStatusEmails !== null
        ? (afterData.customerStatusEmails as Record<string, unknown>)
        : {}) as Record<string, unknown>;

    if ((currentStatus === "Shipped" && statusEmails.shipped === true) ||
        (currentStatus === "Delivered" && statusEmails.delivered === true)) {
      return null;
    }

    const apiKey = normalizeText(SENDGRID_KEY.value(), 5000);
    const fromEmail = normalizeEmail(SENDGRID_FROM_EMAIL.value());
    const fromName = normalizeText(SENDGRID_FROM_NAME.value(), 120) || "TrendMix";
    if (!apiKey || !fromEmail) {
      console.error("SendGrid configuration missing for customer status notifications", { orderId, currentStatus });
      return null;
    }

    const parsed = parseOrderEmailContext(afterData, orderId);
    if (!parsed.customerEmail) {
      console.warn("Customer email missing for status notification", { orderId, currentStatus });
      return null;
    }

    const emailBody =
      currentStatus === "Shipped"
        ? buildCustomerShippedEmail(orderId, parsed)
        : buildCustomerDeliveredEmail(orderId, parsed);

    sgMail.setApiKey(apiKey);

    try {
      await sgMail.send({
        to: parsed.customerEmail,
        from: {
          email: fromEmail,
          name: fromName,
        },
        subject: emailBody.subject,
        text: emailBody.text,
      });

      const updatedStatusEmails: Record<string, unknown> = {
        ...statusEmails,
        [currentStatus === "Shipped" ? "shipped" : "delivered"]: true,
      };

      await change.after.ref.set(
        {
          customerStatusEmails: updatedStatusEmails,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Failed to send customer status update email", {
        orderId,
        currentStatus,
        customerEmail: parsed.customerEmail,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return null;
  });
