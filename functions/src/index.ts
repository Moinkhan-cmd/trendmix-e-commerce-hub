import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Razorpay from "razorpay";
import * as crypto from "crypto";
import cors from "cors";

// ─── Firebase Admin Init ────────────────────────────────────
admin.initializeApp();
const db = admin.firestore();

// ─── CORS (allow your frontend origins) ─────────────────────
const corsHandler = cors({
  origin: true, // In production, restrict to your domain(s)
});

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
      // Only allow POST
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      // ── Authenticate the user via Firebase ID token ───────
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized – missing or invalid token" });
        return;
      }

      const idToken = authHeader.split("Bearer ")[1];
      let decodedToken: admin.auth.DecodedIdToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch {
        res.status(401).json({ error: "Unauthorized – invalid token" });
        return;
      }

      const userId = decodedToken.uid;

      // ── Validate request body ─────────────────────────────
      const { amount, currency = "INR", receipt, notes } = req.body;

      if (!amount || typeof amount !== "number" || amount <= 0) {
        res.status(400).json({ error: "Invalid amount. Must be a positive number (in paise)." });
        return;
      }

      // Razorpay expects amount in smallest currency unit (paise for INR)
      const amountInPaise = Math.round(amount);

      if (amountInPaise < 100) {
        res.status(400).json({ error: "Minimum order amount is ₹1 (100 paise)." });
        return;
      }

      // ── Create Razorpay Order ─────────────────────────────
      const razorpay = getRazorpayInstance();

      const orderOptions: {
        amount: number;
        currency: string;
        receipt: string;
        notes: Record<string, string>;
      } = {
        amount: amountInPaise,
        currency,
        receipt: receipt || `receipt_${Date.now()}`,
        notes: {
          userId,
          ...(notes || {}),
        },
      };

      let order;
      try {
        order = await razorpay.orders.create(orderOptions);
      } catch (rzpError: unknown) {
        const err = rzpError as { statusCode?: number; error?: { description?: string } };
        if (err.statusCode === 401) {
          console.error("Razorpay authentication failed – check your API keys in functions/.env");
          res.status(500).json({
            error: "Payment gateway authentication failed. Please contact support.",
          });
          return;
        }
        throw rzpError;
      }

      // ── Save pending order to Firestore ───────────────────
      await db.collection("razorpay_orders").doc(order.id).set({
        userId,
        razorpay_order_id: order.id,
        amount: amountInPaise,
        currency,
        receipt: orderOptions.receipt,
        status: "created",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // ── Return order details to frontend ──────────────────
      res.status(200).json({
        success: true,
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
        },
        key: process.env.RAZORPAY_KEY_ID, // Only the KEY_ID (public), never the secret
      });
    } catch (error: unknown) {
      console.error("createRazorpayOrder error:", error);
      const message = error instanceof Error ? error.message : "Internal server error";
      res.status(500).json({ error: message });
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
      // Only allow POST
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      // ── Authenticate the user ─────────────────────────────
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized – missing or invalid token" });
        return;
      }

      const idToken = authHeader.split("Bearer ")[1];
      let decodedToken: admin.auth.DecodedIdToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch {
        res.status(401).json({ error: "Unauthorized – invalid token" });
        return;
      }

      const userId = decodedToken.uid;

      // ── Validate request body ─────────────────────────────
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        amount,
        orderDetails,
      } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        res.status(400).json({
          error: "Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature",
        });
        return;
      }

      // ── Verify Signature ──────────────────────────────────
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        throw new Error("RAZORPAY_KEY_SECRET is not configured");
      }

      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(body)
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        console.error("Signature verification failed", {
          razorpay_order_id,
          razorpay_payment_id,
        });

        // Update order status to failed
        await db.collection("razorpay_orders").doc(razorpay_order_id).update({
          status: "signature_failed",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.status(400).json({
          success: false,
          error: "Payment verification failed – invalid signature",
        });
        return;
      }

      // ── Signature is valid → Store confirmed payment ──────
      const paymentData = {
        userId,
        amount: amount || null,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        status: "Paid",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ...(orderDetails || {}),
      };

      // Save to payments collection
      await db.collection("payments").add(paymentData);

      // Update the razorpay_orders document
      await db.collection("razorpay_orders").doc(razorpay_order_id).update({
        status: "paid",
        razorpay_payment_id,
        razorpay_signature,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).json({
        success: true,
        message: "Payment verified and recorded successfully",
        paymentId: razorpay_payment_id,
      });
    } catch (error: unknown) {
      console.error("verifyRazorpayPayment error:", error);
      const message = error instanceof Error ? error.message : "Internal server error";
      res.status(500).json({ error: message });
    }
  });
});
