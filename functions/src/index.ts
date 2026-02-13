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

const SHIPPING_THRESHOLD_INR = 999;
const SHIPPING_COST_INR = 49;
const TEST_COUPON_DISCOUNT_INR = 120;
const DEFAULT_RECAPTCHA_MIN_SCORE = 0.5;

const SENDGRID_KEY = defineSecret("SENDGRID_KEY");
const SENDGRID_FROM_EMAIL = defineString("SENDGRID_FROM_EMAIL", { default: "" });
const SENDGRID_FROM_NAME = defineString("SENDGRID_FROM_NAME", { default: "TrendMix" });
const SENDGRID_ADMIN_EMAIL = defineString("SENDGRID_ADMIN_EMAIL", { default: "" });
const SENDGRID_SEND_CUSTOMER_CONFIRMATION = defineString("SENDGRID_SEND_CUSTOMER_CONFIRMATION", {
  default: "true",
});

type SanitizedCustomer = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  notes?: string;
};

type SanitizedOrderItem = {
  productId: string;
  qty: number;
};

type CalculatedOrder = {
  items: Array<{
    productId: string;
    name: string;
    qty: number;
    price: number;
    imageUrl: string;
  }>;
  customer: SanitizedCustomer;
  subtotal: number;
  shipping: number;
  discount: number;
  couponApplied: boolean;
  total: number;
};

type RecaptchaResult = {
  success: boolean;
  score: number;
  action: string;
  error?: string;
};

// ─── CORS (allow your frontend origins) ─────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const corsHandler = cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin not allowed by CORS policy"));
  },
});

function getClientIp(req: functions.https.Request): string {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.ip || "unknown";
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function shouldBypassRecaptcha(req: functions.https.Request, token: string, expectedAction: string): boolean {
  const allowBypass = (process.env.ALLOW_RECAPTCHA_BYPASS_LOCALHOST ?? "").trim().toLowerCase();
  const bypassEnabled = ["1", "true", "yes", "on"].includes(allowBypass);
  if (!bypassEnabled) return false;

  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  if (!isLocalhostOrigin(origin)) return false;

  return token === `local_dev_bypass_token_${expectedAction}`;
}

function normalizeText(value: unknown, maxLength = 200): string {
  if (typeof value !== "string") return "";
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeEmail(value: unknown): string {
  return normalizeText(value, 254).toLowerCase();
}

function ensureValidEmail(value: unknown, errorMessage: string): string {
  const email = normalizeEmail(value);
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new functions.https.HttpsError("invalid-argument", errorMessage);
  }
  return email;
}

function normalizePhone(value: unknown): string {
  return normalizeText(value, 24).replace(/\D/g, "").slice(0, 13);
}

function normalizeCouponCode(value: unknown): string {
  return normalizeText(value, 80);
}

function getCouponHashConfig(): string {
  const configuredHash = normalizeText(process.env.CHECKOUT_TEST_COUPON_SHA256, 128).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(configuredHash)) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Checkout coupon is not configured on backend."
    );
  }
  return configuredHash;
}

function isValidCheckoutCoupon(couponCode: string): boolean {
  const normalized = normalizeCouponCode(couponCode);
  if (!normalized) return false;
  const configuredHash = getCouponHashConfig();
  const incomingHash = crypto.createHash("sha256").update(normalized).digest("hex");
  return safeCompareHex(incomingHash, configuredHash);
}

function safeCompareHex(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function getRecaptchaMinScore(): number {
  const configured = Number(process.env.RECAPTCHA_MIN_SCORE ?? DEFAULT_RECAPTCHA_MIN_SCORE);
  if (Number.isFinite(configured) && configured >= 0 && configured <= 1) {
    return configured;
  }
  return DEFAULT_RECAPTCHA_MIN_SCORE;
}

function getRecaptchaSecret(): string {
  const secret = process.env.RECAPTCHA_SECRET_KEY?.trim().replace(/^"|"$/g, "") ?? "";
  if (!secret) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "reCAPTCHA secret is not configured on the backend."
    );
  }
  return secret;
}

async function verifyRecaptchaToken(
  token: string,
  expectedAction: string,
  clientIp: string
): Promise<RecaptchaResult> {
  const secret = getRecaptchaSecret();
  const minScore = getRecaptchaMinScore();

  const payload = new URLSearchParams({
    secret,
    response: token,
  });

  if (clientIp && clientIp !== "unknown") {
    payload.append("remoteip", clientIp);
  }

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload.toString(),
  });

  if (!response.ok) {
    return {
      success: false,
      score: 0,
      action: expectedAction,
      error: "reCAPTCHA service unavailable.",
    };
  }

  const verification = (await response.json()) as {
    success?: boolean;
    score?: number;
    action?: string;
    "error-codes"?: string[];
  };

  const score = typeof verification.score === "number" ? verification.score : 0;
  const action = typeof verification.action === "string" ? verification.action : "";

  if (!verification.success) {
    return {
      success: false,
      score,
      action,
      error: "Failed reCAPTCHA validation.",
    };
  }

  if (action !== expectedAction) {
    return {
      success: false,
      score,
      action,
      error: "Invalid reCAPTCHA action.",
    };
  }

  if (score < minScore) {
    return {
      success: false,
      score,
      action,
      error: `Suspicious activity detected (score ${score.toFixed(2)}).`,
    };
  }

  return {
    success: true,
    score,
    action,
  };
}

async function checkRateLimit(key: string, windowSeconds: number, maxAttempts: number): Promise<void> {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const ref = db.collection("security_rate_limits").doc(key);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() as { attempts?: number; firstAttemptAt?: number; blockedUntil?: number }) : {};

    const blockedUntil = Number(data.blockedUntil ?? 0);
    if (blockedUntil > now) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `Too many attempts. Try again in ${Math.ceil((blockedUntil - now) / 1000)} seconds.`
      );
    }

    const firstAttemptAt = Number(data.firstAttemptAt ?? now);
    const attempts = Number(data.attempts ?? 0);

    const isWindowExpired = firstAttemptAt < windowStart;
    const nextAttempts = isWindowExpired ? 1 : attempts + 1;
    const nextFirstAttemptAt = isWindowExpired ? now : firstAttemptAt;

    if (nextAttempts > maxAttempts) {
      const nextBlockedUntil = now + windowSeconds * 1000;
      tx.set(
        ref,
        {
          attempts: nextAttempts,
          firstAttemptAt: nextFirstAttemptAt,
          blockedUntil: nextBlockedUntil,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      throw new functions.https.HttpsError(
        "resource-exhausted",
        `Too many attempts. Try again in ${windowSeconds} seconds.`
      );
    }

    tx.set(
      ref,
      {
        attempts: nextAttempts,
        firstAttemptAt: nextFirstAttemptAt,
        blockedUntil: 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

async function verifyAuthenticatedUser(req: functions.https.Request): Promise<admin.auth.DecodedIdToken> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new functions.https.HttpsError("unauthenticated", "Missing authentication token.");
  }

  const idToken = authHeader.split("Bearer ")[1];
  const decoded = await admin.auth().verifyIdToken(idToken, true);

  if (!decoded.email_verified) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Please verify your email before performing this action."
    );
  }

  return decoded;
}

async function verifyAdminUser(req: functions.https.Request): Promise<admin.auth.DecodedIdToken> {
  const decoded = await verifyAuthenticatedUser(req);
  if (decoded.admin === true) return decoded;

  const adminSnap = await db.collection("admins").doc(decoded.uid).get();
  if (!adminSnap.exists) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }

  return decoded;
}

function sanitizeCustomer(raw: unknown): SanitizedCustomer {
  const source = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

  const customer: SanitizedCustomer = {
    name: normalizeText(source.name, 80),
    email: normalizeEmail(source.email),
    phone: normalizePhone(source.phone),
    address: normalizeText(source.address, 250),
    city: normalizeText(source.city, 80),
    state: normalizeText(source.state, 80),
    pincode: normalizeText(source.pincode, 12).replace(/\D/g, "").slice(0, 6),
    notes: normalizeText(source.notes, 300),
  };

  if (customer.name.length < 2) throw new functions.https.HttpsError("invalid-argument", "Invalid customer name.");
  ensureValidEmail(customer.email, "Invalid customer email.");
  if (!/^\d{10,13}$/.test(customer.phone)) throw new functions.https.HttpsError("invalid-argument", "Invalid customer phone number.");
  if (customer.address.length < 10) throw new functions.https.HttpsError("invalid-argument", "Invalid shipping address.");
  if (customer.city.length < 2) throw new functions.https.HttpsError("invalid-argument", "Invalid city.");
  if (customer.state.length < 2) throw new functions.https.HttpsError("invalid-argument", "Invalid state.");
  if (!/^\d{6}$/.test(customer.pincode)) throw new functions.https.HttpsError("invalid-argument", "Invalid pincode.");

  if (!customer.notes) {
    delete customer.notes;
  }

  return customer;
}

function sanitizeItems(raw: unknown): SanitizedOrderItem[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new functions.https.HttpsError("invalid-argument", "Order items are required.");
  }

  const items: SanitizedOrderItem[] = raw.map((item) => {
    const source = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
    const productId = normalizeText(source.productId, 128);
    const qty = Number(source.qty);

    if (!productId) {
      throw new functions.https.HttpsError("invalid-argument", "Order item productId is required.");
    }

    if (!Number.isInteger(qty) || qty <= 0 || qty > 10) {
      throw new functions.https.HttpsError("invalid-argument", "Order item quantity is invalid.");
    }

    return { productId, qty };
  });

  return items;
}

function generateOrderNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `TM-${datePart}-${randomPart}`;
}

function createOrderTimelineNote(paymentId: string): Array<Record<string, unknown>> {
  return [
    {
      status: "Pending",
      note: `Order placed. Payment verified (${paymentId}).`,
      timestamp: admin.firestore.Timestamp.now(),
    },
  ];
}

async function calculateCanonicalOrder(
  items: SanitizedOrderItem[],
  customer: SanitizedCustomer,
  couponCode?: unknown
): Promise<CalculatedOrder> {
  const productRefs = items.map((item) => db.collection("products").doc(item.productId));
  const productSnaps = await db.getAll(...productRefs);

  const resolvedItems = items.map((item, index) => {
    const snap = productSnaps[index];
    if (!snap.exists) {
      throw new functions.https.HttpsError("invalid-argument", `Product not found: ${item.productId}`);
    }

    const data = snap.data() as { name?: string; price?: number; stock?: number; imageUrls?: string[]; image?: string };
    const price = Number(data.price ?? 0);
    const stock = Number(data.stock ?? 0);

    if (!Number.isFinite(price) || price <= 0) {
      throw new functions.https.HttpsError("failed-precondition", `Product price is invalid: ${item.productId}`);
    }

    if (stock < item.qty) {
      throw new functions.https.HttpsError("failed-precondition", `Insufficient stock for: ${data.name ?? item.productId}`);
    }

    return {
      productId: item.productId,
      name: normalizeText(data.name ?? "Product", 160),
      qty: item.qty,
      price,
      imageUrl: normalizeText((data.imageUrls?.[0] ?? data.image ?? "") as string, 400),
    };
  });

  const subtotal = resolvedItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const shipping = subtotal >= SHIPPING_THRESHOLD_INR ? 0 : SHIPPING_COST_INR;
  const grossTotal = subtotal + shipping;
  const couponApplied = isValidCheckoutCoupon(normalizeCouponCode(couponCode));
  const discount = couponApplied ? Math.min(TEST_COUPON_DISCOUNT_INR, grossTotal) : 0;
  const total = Math.max(0, grossTotal - discount);

  return {
    items: resolvedItems,
    customer,
    subtotal,
    shipping,
    discount,
    couponApplied,
    total,
  };
}

function getHttpsError(err: unknown): functions.https.HttpsError {
  if (err instanceof functions.https.HttpsError) return err;
  return new functions.https.HttpsError("internal", "Internal server error.");
}

function sendError(res: functions.Response, err: unknown): void {
  const mapped = getHttpsError(err);
  const codeMap: Record<string, number> = {
    "invalid-argument": 400,
    unauthenticated: 401,
    "permission-denied": 403,
    "not-found": 404,
    "already-exists": 409,
    "failed-precondition": 412,
    "resource-exhausted": 429,
    internal: 500,
  };

  const status = codeMap[mapped.code] ?? 500;
  res.status(status).json({
    success: false,
    error: mapped.message,
  });
}

type SendGridRuntimeConfig = {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  adminEmail: string;
  sendCustomerConfirmation: boolean;
};

type OrderEmailItem = {
  name?: unknown;
  qty?: unknown;
  price?: unknown;
};

type OrderEmailDoc = {
  orderNumber?: unknown;
  total?: unknown;
  subtotal?: unknown;
  shipping?: unknown;
  customer?: {
    name?: unknown;
    email?: unknown;
    phone?: unknown;
    address?: unknown;
    city?: unknown;
    state?: unknown;
    pincode?: unknown;
  };
  items?: OrderEmailItem[];
  payment?: {
    method?: unknown;
    status?: unknown;
    transactionId?: unknown;
  };
  createdAt?: admin.firestore.Timestamp;
};

function readConfigString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/^"|"$/g, "");
}

function readConfigBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "on"].includes(normalized);
  }
  return fallback;
}

function getSendGridRuntimeConfig(): SendGridRuntimeConfig {
  const secretValue = SENDGRID_KEY.value();
  const fromEmail = SENDGRID_FROM_EMAIL.value();
  const fromName = SENDGRID_FROM_NAME.value();
  const adminEmail = SENDGRID_ADMIN_EMAIL.value();
  const sendCustomerConfirmation = SENDGRID_SEND_CUSTOMER_CONFIRMATION.value();

  return {
    apiKey: readConfigString(secretValue),
    fromEmail: readConfigString(fromEmail),
    fromName: readConfigString(fromName) || "TrendMix",
    adminEmail: normalizeEmail(readConfigString(adminEmail)),
    sendCustomerConfirmation: readConfigBoolean(sendCustomerConfirmation, false),
  };
}

function formatInr(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "₹0.00";
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatOrderTimestamp(value: unknown): string {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  }
  return new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function buildProductLines(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const source = (typeof item === "object" && item !== null ? item : {}) as OrderEmailItem;
    const name = normalizeText(source.name, 160) || "Item";
    const qty = Number(source.qty ?? 0);
    const price = Number(source.price ?? 0);
    const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
    return `${name} × ${safeQty} (${formatInr(price)})`;
  });
}

function buildAddress(customer: OrderEmailDoc["customer"]): string {
  if (!customer) return "N/A";
  const parts = [
    normalizeText(customer.address, 300),
    normalizeText(customer.city, 100),
    normalizeText(customer.state, 100),
    normalizeText(customer.pincode, 20),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "N/A";
}

async function acquireOrderEmailLock(
  orderRef: admin.firestore.DocumentReference,
  emailType: "adminOrderEmail" | "customerOrderEmail",
  eventId: string
): Promise<"acquired" | "skip-sent" | "skip-locked"> {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) return "skip-locked";

    const data = (snap.data() ?? {}) as {
      notifications?: {
        adminOrderEmail?: { status?: string; lockEventId?: string; lockAt?: admin.firestore.Timestamp };
        customerOrderEmail?: { status?: string; lockEventId?: string; lockAt?: admin.firestore.Timestamp };
      };
    };

    const current = data.notifications?.[emailType] as
      | { status?: string; lockEventId?: string; lockAt?: admin.firestore.Timestamp }
      | undefined;

    if (current?.status === "sent") {
      return "skip-sent";
    }

    const lockAtMs =
      current?.lockAt instanceof admin.firestore.Timestamp ? current.lockAt.toMillis() : 0;
    const lockIsFresh = lockAtMs > 0 && Date.now() - lockAtMs < 15 * 60 * 1000;
    const lockOwnedByOtherEvent =
      current?.status === "sending" &&
      lockIsFresh &&
      typeof current.lockEventId === "string" &&
      current.lockEventId !== eventId;

    if (lockOwnedByOtherEvent) {
      return "skip-locked";
    }

    const basePath = `notifications.${emailType}`;
    tx.update(orderRef, {
      [`${basePath}.status`]: "sending",
      [`${basePath}.lockEventId`]: eventId,
      [`${basePath}.lockAt`]: admin.firestore.FieldValue.serverTimestamp(),
      [`${basePath}.updatedAt`]: admin.firestore.FieldValue.serverTimestamp(),
      [`${basePath}.attempts`]: admin.firestore.FieldValue.increment(1),
    });

    return "acquired";
  });
}

async function markOrderEmailSent(
  orderRef: admin.firestore.DocumentReference,
  emailType: "adminOrderEmail" | "customerOrderEmail",
  sentFlagField: "emailSent" | "customerEmailSent"
): Promise<void> {
  const basePath = `notifications.${emailType}`;
  await orderRef.set(
    {
      [sentFlagField]: true,
      [basePath]: {
        status: "sent",
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        lockEventId: admin.firestore.FieldValue.delete(),
        lockAt: admin.firestore.FieldValue.delete(),
        lastError: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function markOrderEmailFailed(
  orderRef: admin.firestore.DocumentReference,
  emailType: "adminOrderEmail" | "customerOrderEmail",
  errorMessage: string
): Promise<void> {
  const basePath = `notifications.${emailType}`;
  await orderRef.set(
    {
      [basePath]: {
        status: "failed",
        lastError: normalizeText(errorMessage, 500),
        lockEventId: admin.firestore.FieldValue.delete(),
        lockAt: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
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

      const keySecret = process.env.RAZORPAY_KEY_SECRET;
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

export const verifyGuestRazorpayPayment = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Method not allowed" });
        return;
      }

      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        guestEmail,
      } = req.body as {
        razorpay_order_id?: string;
        razorpay_payment_id?: string;
        razorpay_signature?: string;
        guestEmail?: string;
      };

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Missing required payment verification fields."
        );
      }

      const normalizedGuestEmail = ensureValidEmail(guestEmail, "Guest email is required.");

      const keySecret = process.env.RAZORPAY_KEY_SECRET;
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
        mode?: string;
        guestEmail?: string;
        status?: string;
        amount?: number;
        calculatedOrder?: CalculatedOrder;
        orderId?: string;
        orderNumber?: string;
      };

      if (orderData.mode !== "guest") {
        throw new functions.https.HttpsError("permission-denied", "This payment is not a guest checkout session.");
      }

      if (normalizeEmail(orderData.guestEmail ?? "") !== normalizedGuestEmail) {
        throw new functions.https.HttpsError("permission-denied", "You are not allowed to verify this payment.");
      }

      if (!orderData.calculatedOrder) {
        throw new functions.https.HttpsError("failed-precondition", "Guest order details are missing.");
      }

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

      const calculatedOrder = orderData.calculatedOrder;
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
          userId: null,
          checkoutMode: "guest",
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
          userId: null,
          userEmail: normalizedGuestEmail,
          amount: orderData.amount ?? Math.round(calculatedOrder.total * 100),
          razorpay_order_id: String(razorpay_order_id),
          razorpay_payment_id: String(razorpay_payment_id),
          status: "Paid",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      });

      await db
        .collection("guest_checkout_intents")
        .where("razorpay_order_id", "==", String(razorpay_order_id))
        .get()
        .then(async (snap) => {
          const updates = snap.docs.map((docSnap) =>
            docSnap.ref.set(
              {
                status: "paid",
                orderId: orderRef.id,
                orderNumber,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            )
          );
          await Promise.all(updates);
        });

      res.status(200).json({
        success: true,
        message: "Payment verified successfully.",
        paymentId: String(razorpay_payment_id),
        orderId: orderRef.id,
        orderNumber,
      });
    } catch (error: unknown) {
      console.error("verifyGuestRazorpayPayment error:", error);
      sendError(res, error);
    }
  });
});

export const validateCheckoutCoupon = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Method not allowed" });
        return;
      }

      const body = req.body as { couponCode?: unknown };
      const couponCode = normalizeCouponCode(body.couponCode);
      if (!couponCode) {
        throw new functions.https.HttpsError("invalid-argument", "Coupon code is required.");
      }

      const clientIp = getClientIp(req);
      await checkRateLimit(`checkout_coupon_${clientIp}`, 60, 20);

      const valid = isValidCheckoutCoupon(couponCode);

      res.status(200).json({
        success: true,
        valid,
        discount: valid ? TEST_COUPON_DISCOUNT_INR : 0,
        message: valid ? "Coupon applied." : "Invalid coupon code.",
      });
    } catch (error: unknown) {
      console.error("validateCheckoutCoupon error:", error);
      sendError(res, error);
    }
  });
});

export const verifyRecaptchaAssessment = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Method not allowed" });
        return;
      }

      const body = req.body as { token?: string; action?: string };
      const token = normalizeText(body.token, 4096);
      const action = normalizeText(body.action, 80);

      if (!token || !action) {
        throw new functions.https.HttpsError("invalid-argument", "Missing reCAPTCHA token or action.");
      }

      if (!["signup", "login", "checkout"].includes(action)) {
        throw new functions.https.HttpsError("invalid-argument", "Unsupported reCAPTCHA action.");
      }

      const clientIp = getClientIp(req);
      const rateLimitKey = `${action}:${clientIp}`;
      await checkRateLimit(rateLimitKey, 60, 12);

      const result = shouldBypassRecaptcha(req, token, action)
        ? { success: true, score: 1, action }
        : await verifyRecaptchaToken(token, action, clientIp);
      if (!result.success) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Security verification failed. Please retry."
        );
      }

      res.status(200).json({
        success: true,
        score: result.score,
        action: result.action,
      });
    } catch (error: unknown) {
      console.error("verifyRecaptchaAssessment error:", error);
      sendError(res, error);
    }
  });
});

export const getNotificationHealth = functions
  .runWith({ secrets: [SENDGRID_KEY] })
  .https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "GET") {
        res.status(405).json({ success: false, error: "Method not allowed" });
        return;
      }

      await verifyAdminUser(req);

      const settingsSnap = await db.collection("settings").doc("notifications").get();
      const settingsData = settingsSnap.exists
        ? (settingsSnap.data() as Record<string, unknown>)
        : {};

      const runtime = getSendGridRuntimeConfig();
      const settingsAdminEmail = normalizeEmail(normalizeText(settingsData.adminEmail, 254));
      const resolvedAdminEmail = settingsAdminEmail || runtime.adminEmail;

      const health = {
        sendgridKeyConfigured: Boolean(runtime.apiKey),
        fromEmailConfigured: Boolean(runtime.fromEmail),
        adminEmailConfigured: Boolean(resolvedAdminEmail),
        sendgridReadyForAdminNotifications:
          Boolean(runtime.apiKey) && Boolean(runtime.fromEmail) && Boolean(resolvedAdminEmail),
        adminEmailSource: settingsAdminEmail ? "settings" : runtime.adminEmail ? "params" : "missing",
      };

      res.status(200).json({
        success: true,
        health,
      });
    } catch (error: unknown) {
      console.error("getNotificationHealth error:", error);
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
    const order = snapshot.data() as OrderEmailDoc;

    const paymentMethod = normalizeText(order.payment?.method, 40).toLowerCase();
    const paymentStatus = normalizeText(order.payment?.status, 40).toLowerCase();
    const paymentId = normalizeText(order.payment?.transactionId, 120);

    if (paymentMethod !== "online" || paymentStatus !== "completed" || !paymentId) {
      console.info("Skipping email trigger for non-verified/non-online order", {
        orderId,
        paymentMethod,
        paymentStatus,
      });
      return null;
    }

    const [storeSnap, notificationSnap] = await Promise.all([
      db.collection("settings").doc("store").get(),
      db.collection("settings").doc("notifications").get(),
    ]);

    if (storeSnap.exists && storeSnap.data()?.enableNotifications === false) {
      console.info("Global notifications disabled. Skipping email notifications.", { orderId });
      return null;
    }

    const notificationSettings = notificationSnap.exists
      ? (notificationSnap.data() as Record<string, unknown>)
      : {};

    if (notificationSettings.notifyOnNewOrder === false) {
      console.info("New order notifications disabled in settings. Skipping.", { orderId });
      return null;
    }

    const sendGridConfig = getSendGridRuntimeConfig();
    if (!sendGridConfig.apiKey || !sendGridConfig.fromEmail) {
      console.error(
        "SendGrid config missing. Set params: SENDGRID_KEY and SENDGRID_FROM_EMAIL"
      );
      return null;
    }

    const adminEmail = normalizeEmail(
      normalizeText(notificationSettings.adminEmail, 254) || sendGridConfig.adminEmail
    );
    if (!adminEmail) {
      console.error("Admin email is missing. Set settings/notifications.adminEmail or param SENDGRID_ADMIN_EMAIL");
      return null;
    }

    sgMail.setApiKey(sendGridConfig.apiKey);

    const customerName = normalizeText(order.customer?.name, 120) || "Customer";
    const customerEmail = normalizeEmail(order.customer?.email);
    const customerPhone = normalizeText(order.customer?.phone, 30) || "N/A";
    const deliveryAddress = buildAddress(order.customer);
    const productLines = buildProductLines(order.items);
    const subtotalText = formatInr(order.subtotal);
    const shippingText = Number(order.shipping ?? 0) === 0 ? "Free" : formatInr(order.shipping);
    const totalText = formatInr(order.total);
    const orderTimestamp = formatOrderTimestamp(order.createdAt);
    const orderNumber = normalizeText(order.orderNumber, 80) || orderId;

    const adminLock = await acquireOrderEmailLock(snapshot.ref, "adminOrderEmail", context.eventId);
    if (adminLock === "acquired") {
      try {
        const htmlItems = productLines.map((line) => `<li>${line}</li>`).join("");
        await sgMail.send({
          to: adminEmail,
          from: {
            email: sendGridConfig.fromEmail,
            name: sendGridConfig.fromName,
          },
          subject: `New paid order: ${orderNumber}`,
          text: [
            "New paid order received",
            `Order ID: ${orderId}`,
            `Order Number: ${orderNumber}`,
            `Customer Name: ${customerName}`,
            `Customer Email: ${customerEmail || "N/A"}`,
            `Phone: ${customerPhone}`,
            `Products: ${productLines.join(" | ") || "N/A"}`,
            `Subtotal: ${subtotalText}`,
            `Shipping: ${shippingText}`,
            `Total: ${totalText}`,
            `Payment ID: ${paymentId}`,
            `Delivery Address: ${deliveryAddress}`,
            `Order Timestamp: ${orderTimestamp}`,
          ].join("\n"),
          html: `
            <h2>New paid order received</h2>
            <p><strong>Order ID:</strong> ${orderId}</p>
            <p><strong>Order Number:</strong> ${orderNumber}</p>
            <p><strong>Customer Name:</strong> ${customerName}</p>
            <p><strong>Customer Email:</strong> ${customerEmail || "N/A"}</p>
            <p><strong>Phone:</strong> ${customerPhone}</p>
            <p><strong>Product List:</strong></p>
            <ul>${htmlItems}</ul>
            <p><strong>Subtotal:</strong> ${subtotalText}</p>
            <p><strong>Shipping:</strong> ${shippingText}</p>
            <p><strong>Total:</strong> ${totalText}</p>
            <p><strong>Payment ID:</strong> ${paymentId}</p>
            <p><strong>Delivery Address:</strong> ${deliveryAddress}</p>
            <p><strong>Order Timestamp:</strong> ${orderTimestamp}</p>
          `,
          customArgs: {
            eventType: "admin-new-order",
            orderId,
            paymentId,
          },
        });

        await markOrderEmailSent(snapshot.ref, "adminOrderEmail", "emailSent");
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown SendGrid error";
        console.error("Failed to send admin order email", { orderId, error: errorMessage });
        await markOrderEmailFailed(snapshot.ref, "adminOrderEmail", errorMessage);
      }
    }

    const sendCustomerConfirmation =
      typeof notificationSettings.sendCustomerConfirmation === "boolean"
        ? Boolean(notificationSettings.sendCustomerConfirmation)
        : sendGridConfig.sendCustomerConfirmation;

    if (!sendCustomerConfirmation || !customerEmail) {
      return null;
    }

    const customerLock = await acquireOrderEmailLock(snapshot.ref, "customerOrderEmail", context.eventId);
    if (customerLock !== "acquired") {
      return null;
    }

    try {
      await sgMail.send({
        to: customerEmail,
        from: {
          email: sendGridConfig.fromEmail,
          name: sendGridConfig.fromName,
        },
        subject: `Order confirmed: ${orderNumber}`,
        text: [
          `Hi ${customerName},`,
          "Your payment was successful and your order is confirmed.",
          `Order Number: ${orderNumber}`,
          `Order ID: ${orderId}`,
          `Payment ID: ${paymentId}`,
          `Total: ${totalText}`,
          `Delivery Address: ${deliveryAddress}`,
          `Order Timestamp: ${orderTimestamp}`,
        ].join("\n"),
        html: `
          <p>Hi ${customerName},</p>
          <p>Your payment was successful and your order is confirmed.</p>
          <p><strong>Order Number:</strong> ${orderNumber}</p>
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Payment ID:</strong> ${paymentId}</p>
          <p><strong>Total:</strong> ${totalText}</p>
          <p><strong>Delivery Address:</strong> ${deliveryAddress}</p>
          <p><strong>Order Timestamp:</strong> ${orderTimestamp}</p>
        `,
          customArgs: {
            eventType: "customer-order-confirmation",
            orderId,
            paymentId,
          },
      });

      await markOrderEmailSent(snapshot.ref, "customerOrderEmail", "customerEmailSent");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown SendGrid error";
      console.error("Failed to send customer confirmation email", {
        orderId,
        error: errorMessage,
      });
      await markOrderEmailFailed(snapshot.ref, "customerOrderEmail", errorMessage);
    }

    return null;
  });
