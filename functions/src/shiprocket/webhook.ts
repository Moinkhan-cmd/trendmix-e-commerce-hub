/**
 * shiprocketWebhook
 * ──────────────────
 * Receives and processes real-time tracking updates pushed by Shiprocket.
 *
 * Setup in Shiprocket dashboard:
 *   Panel → Settings → API → Webhook URL
 *   Set to: https://<region>-<project>.cloudfunctions.net/shiprocketWebhook
 *
 * Security:
 *   Shiprocket does not sign webhooks with an HMAC, but you can add an optional
 *   shared secret via query-param or header. Configure SHIPROCKET_WEBHOOK_SECRET
 *   in your env and pass it as ?secret=<value> when registering the URL in the
 *   Shiprocket dashboard. If the env var is empty, the check is skipped.
 *
 * Flow:
 *   1. Optionally validate the shared secret query-param.
 *   2. Validate that the payload has a non-empty `awb` field.
 *   3. Look up the matching order in Firestore (first by awb_code, then by
 *      shiprocket_order_id as a fallback).
 *   4. Map Shiprocket's status to our internal status.
 *   5. Merge the tracking fields into the order document.
 *
 * Firestore fields updated:
 *   - shipment_status           (internal lifecycle status)
 *   - status                    (user-facing order status shown in UI)
 *   - raw_shiprocket_status     (raw value from Shiprocket, for debugging)
 *   - last_tracking_update      (server timestamp)
 *   - delivery_date             (when status = Delivered)
 *   - last_location             (last known location string)
 *   - trackingNumber            (AWB, so the UI always has it)
 *   - updatedAt
 */

import * as admin from "firebase-admin";
import type { ShiprocketWebhookPayload } from "./types";

// ─── Status mapping ───────────────────────────────────────────
/**
 * Maps Shiprocket status keys/codes → our internal shipment_status.
 * Shiprocket may send numeric strings ("5") or label strings ("Delivered").
 * We handle both variants.
 */
const STATUS_MAP: Record<string, string> = {
  // Numeric codes
  "1": "Pending",
  "2": "Confirmed",
  "3": "processing",
  "4": "Shipped",
  "5": "Delivered",
  "6": "Cancelled",
  "7": "RTO",
  "8": "RTO Delivered",
  "9": "Lost",
  "10": "Damaged",
  "11": "failed_delivery",
  "12": "Out for Delivery",
  "13": "In Transit",
  "14": "pickup_scheduled",
  "15": "pickup_error",
  "16": "picked_up",
  "17": "rto_initiated",
  "18": "rto_in_transit",
  "19": "rto_delivered",
  // Label strings (Shiprocket occasionally sends these too)
  "Pending": "Pending",
  "Confirmed": "Confirmed",
  "New": "Confirmed",
  "Shipped": "Shipped",
  "In Transit": "In Transit",
  "Shipment Picked Up": "Shipped",
  "Out For Delivery": "Out for Delivery",
  "Out for Delivery": "Out for Delivery",
  "Delivered": "Delivered",
  "Cancelled": "Cancelled",
  "RTO Initiated": "rto_initiated",
  "RTO": "RTO",
  "RTO Delivered": "RTO Delivered",
  "Lost": "Lost",
  "Damaged": "Damaged",
  "Failed Delivery": "failed_delivery",
};

/** User-facing order statuses that are driven by shipment events */
const SHIPMENT_TO_ORDER_STATUS: Record<string, string> = {
  "Shipped": "Shipped",
  "picked_up": "Shipped",
  "In Transit": "Shipped",
  "Out for Delivery": "Out for Delivery",
  "Delivered": "Delivered",
  "Cancelled": "Cancelled",
  "rto_initiated": "RTO Initiated",
  "RTO": "RTO",
  "RTO Delivered": "RTO Delivered",
  "Lost": "Lost",
  "Damaged": "Damaged",
};

// ─── Helpers ─────────────────────────────────────────────────

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function isValidPayload(body: unknown): body is ShiprocketWebhookPayload {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.awb === "string" && b.awb.trim().length > 0;
}

// ─── Public API ───────────────────────────────────────────────

export interface WebhookHandleResult {
  success: boolean;
  message: string;
}

/**
 * Validate the optional shared-secret query param.
 * Returns true if validation passes (or is not configured).
 */
export function validateWebhookSecret(
  querySecret: string | undefined
): boolean {
  const configuredSecret = process.env.SHIPROCKET_WEBHOOK_SECRET
    ?.trim()
    .replace(/^"|"$/g, "");

  // If no secret is configured, skip the check
  if (!configuredSecret) return true;

  return querySecret === configuredSecret;
}

/**
 * Process a Shiprocket webhook payload and update Firestore.
 *
 * @param body  Parsed JSON body of the incoming webhook request.
 */
export async function handleShiprocketWebhook(
  body: unknown
): Promise<WebhookHandleResult> {
  // ── 1. Validate payload shape ─────────────────────────────
  if (!isValidPayload(body)) {
    console.warn("Shiprocket webhook: invalid payload – missing or empty awb", {
      receivedKeys: typeof body === "object" && body !== null
        ? Object.keys(body as object)
        : typeof body,
    });
    return { success: false, message: "Invalid webhook payload: missing awb." };
  }

  const awbCode = asString(body.awb);
  const rawStatus = asString(body.current_status);
  const shiprocketOrderId = asString(String(body.order_id ?? ""));
  const deliveredDate = asString(body.delivered_date);
  const location = asString(body.location);

  // ── 2. Map status ─────────────────────────────────────────
  const internalStatus = STATUS_MAP[rawStatus] ?? rawStatus ?? "unknown";

  console.info("Shiprocket webhook received", {
    awbCode,
    rawStatus,
    internalStatus,
    shiprocketOrderId,
  });

  const db = admin.firestore();

  // ── 3. Find matching order ────────────────────────────────
  // Primary key: awb_code
  const byAwb = await db
    .collection("orders")
    .where("awb_code", "==", awbCode)
    .limit(1)
    .get();

  if (!byAwb.empty) {
    await applyTrackingUpdate(
      byAwb.docs[0].ref,
      internalStatus,
      rawStatus,
      awbCode,
      deliveredDate,
      location
    );
    return { success: true, message: "Order tracking updated via AWB." };
  }

  // Fallback: shiprocket_order_id
  if (shiprocketOrderId) {
    const byOrderId = await db
      .collection("orders")
      .where("shiprocket_order_id", "==", shiprocketOrderId)
      .limit(1)
      .get();

    if (!byOrderId.empty) {
      await applyTrackingUpdate(
        byOrderId.docs[0].ref,
        internalStatus,
        rawStatus,
        awbCode,
        deliveredDate,
        location
      );
      return {
        success: true,
        message: "Order tracking updated via shiprocket_order_id.",
      };
    }
  }

  console.warn("Shiprocket webhook: no matching order", {
    awbCode,
    shiprocketOrderId,
  });
  return {
    success: false,
    message: "No matching order found for AWB or shiprocket_order_id.",
  };
}

// ─── Internal: write tracking update to Firestore ────────────

async function applyTrackingUpdate(
  orderRef: admin.firestore.DocumentReference,
  internalStatus: string,
  rawStatus: string,
  awbCode: string,
  deliveredDate: string,
  location: string
): Promise<void> {
  const update: Record<string, unknown> = {
    shipment_status: internalStatus,
    raw_shiprocket_status: rawStatus,
    trackingNumber: awbCode,
    last_tracking_update: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Map to user-facing order status
  const orderStatus = SHIPMENT_TO_ORDER_STATUS[internalStatus];
  if (orderStatus) {
    update.status = orderStatus;
  }

  // Populate delivery_date when delivered
  if (internalStatus === "Delivered" && deliveredDate) {
    update.delivery_date = deliveredDate;
  }

  // Save last known location
  if (location) {
    update.last_location = location;
  }

  await orderRef.set(update, { merge: true });

  console.info("Order tracking updated in Firestore", {
    orderId: orderRef.id,
    internalStatus,
  });
}
