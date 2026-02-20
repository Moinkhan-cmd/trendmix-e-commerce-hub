/**
 * shiprocketCancellation
 * ───────────────────────
 * Cancels a Shiprocket shipment and updates Firestore.
 *
 * Flow:
 *   1. Load order from Firestore and guard against cancelling delivered orders.
 *   2. If there is a `shiprocket_order_id`, call POST /v1/external/orders/cancel.
 *   3. Update shipment_status = "cancelled" in Firestore regardless of whether a
 *      Shiprocket order existed.
 *   4. Return CancellationResult.
 *
 * The exported `cancelShiprocketShipment` is called by the Cloud Function handler
 * in index.ts. It requires that firebase-admin is already initialised.
 */

import * as admin from "firebase-admin";
import { getShiprocketBearerToken } from "./auth";
import type { CancellationResult } from "./types";

const CANCEL_ORDER_URL =
  "https://apiv2.shiprocket.in/v1/external/orders/cancel";

/**
 * Statuses that mean the shipment has already been delivered – cannot cancel.
 */
const NON_CANCELLABLE_STATUSES = new Set([
  "delivered",
  "Delivered",
  "DELIVERED",
  "RTO Delivered",
  "rto_delivered",
]);

// ─── Helpers ─────────────────────────────────────────────────

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Cancel a Shiprocket shipment linked to a Firestore order.
 *
 * @param orderId  Firestore document ID in the "orders" collection.
 */
export async function cancelShiprocketShipment(
  orderId: string
): Promise<CancellationResult> {
  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();

  // ── Guard: order must exist ───────────────────────────────
  if (!orderSnap.exists) {
    return { success: false, message: "Order not found." };
  }

  const orderData = orderSnap.data() as Record<string, unknown>;
  const shipmentStatus = asString(orderData.shipment_status);
  const orderStatus = asString(orderData.status);
  const shiprocketOrderId = asString(orderData.shiprocket_order_id);

  // ── Guard: already delivered ──────────────────────────────
  if (
    NON_CANCELLABLE_STATUSES.has(shipmentStatus) ||
    NON_CANCELLABLE_STATUSES.has(orderStatus)
  ) {
    return {
      success: false,
      message: "Cannot cancel a shipment that has already been delivered.",
    };
  }

  // ── Guard: already cancelled ──────────────────────────────
  if (shipmentStatus === "cancelled" || shipmentStatus === "Cancelled") {
    return { success: false, message: "Shipment is already cancelled." };
  }

  // ── Case: no Shiprocket order yet – cancel locally only ───
  if (!shiprocketOrderId) {
    await orderRef.set(
      {
        shipment_status: "cancelled",
        status: "Cancelled",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return {
      success: true,
      message: "Order cancelled (no Shiprocket shipment had been created yet).",
    };
  }

  // ── Call Shiprocket cancellation API ─────────────────────
  const token = await getShiprocketBearerToken();

  let response: Response;
  try {
    response = await fetch(CANCEL_ORDER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ids: [shiprocketOrderId] }),
    });
  } catch (networkError) {
    const message =
      networkError instanceof Error ? networkError.message : "Network error";
    console.error("Shiprocket cancellation network error", { orderId, message });
    return { success: false, message: `Network error: ${message}` };
  }

  const bodyText = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = (JSON.parse(bodyText) as Record<string, unknown>) ?? {};
  } catch {
    // ignore
  }

  if (!response.ok) {
    console.error("Shiprocket cancellation API error", {
      orderId,
      shiprocketOrderId,
      status: response.status,
      body: bodyText.slice(0, 300),
    });
    return {
      success: false,
      message: `Shiprocket API returned ${response.status}: ${bodyText.slice(0, 200)}`,
    };
  }

  // ── Update Firestore ──────────────────────────────────────
  await orderRef.set(
    {
      shipment_status: "cancelled",
      status: "Cancelled",
      cancellation_response: parsed,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const successMessage = asString(parsed.message, "Shipment cancelled successfully.");
  return { success: true, message: successMessage };
}
