/**
 * shiprocketPickup
 * ─────────────────
 * Schedules a courier pickup for a Shiprocket shipment after it has been created.
 *
 * Flow:
 *   1. getShiprocketBearerToken() – reuses cached token.
 *   2. POST /v1/external/courier/generate/pickup with { shipment_id, pickup_date }.
 *   3. Returns PickupScheduleResult.
 *   4. Caller (shipment.ts) saves result to Firestore and does NOT throw on failure –
 *      a pickup failure is logged but must not break the order flow.
 *
 * Note: Shiprocket expects pickup_date to be today or a future date in YYYY-MM-DD.
 * We default to today; if the pickup window has already closed for today Shiprocket
 * will return an error – in that case the admin can reschedule manually.
 */

import { getShiprocketBearerToken } from "./auth";
import type { PickupScheduleResult } from "./types";

const GENERATE_PICKUP_URL =
  "https://apiv2.shiprocket.in/v1/external/courier/generate/pickup";

// ─── Helpers ─────────────────────────────────────────────────

/** Returns today's date as "YYYY-MM-DD" in local time */
function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

// ─── Raw API response shape ───────────────────────────────────
interface PickupApiResponse {
  pickup_status?: number;
  response?: {
    pickup_scheduled_date?: string;
    pickup_token_number?: string | number;
    data?: { pickup_scheduled_date?: string };
    message?: string;
  };
  message?: string;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Schedule a pickup for a Shiprocket shipment.
 *
 * @param shipmentId  The `shipment_id` returned by Shiprocket when creating the order.
 *                    May be a number or numeric string.
 * @returns PickupScheduleResult – never throws; errors are captured in the result.
 */
export async function schedulePickup(
  shipmentId: string | number
): Promise<PickupScheduleResult> {
  if (!shipmentId || String(shipmentId).trim() === "" || String(shipmentId) === "0") {
    return { success: false, error: "Invalid or missing shipment_id for pickup scheduling." };
  }

  const token = await getShiprocketBearerToken();
  const pickupDate = todayDateString();

  const payload = {
    shipment_id: [String(shipmentId)],
    pickup_date: [pickupDate],
  };

  let response: Response;
  try {
    response = await fetch(GENERATE_PICKUP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (networkError) {
    const message = networkError instanceof Error ? networkError.message : "Network error";
    return { success: false, error: `Pickup API network error: ${message}` };
  }

  const bodyText = await response.text();
  let parsed: PickupApiResponse = {};
  try {
    parsed = (JSON.parse(bodyText) as PickupApiResponse) ?? {};
  } catch {
    // leave parsed as empty – will be caught below
  }

  if (!response.ok) {
    return {
      success: false,
      error: `Pickup API returned ${response.status}: ${bodyText.slice(0, 200)}`,
    };
  }

  // pickup_status === 1 means successfully scheduled
  if (Number(parsed.pickup_status) !== 1) {
    const msg =
      asString(parsed.response?.message) ||
      asString(parsed.message) ||
      "Pickup scheduling returned non-success status";
    return { success: false, error: msg };
  }

  const resp = parsed.response ?? {};
  const scheduledDate =
    asString(resp.pickup_scheduled_date) ||
    asString(resp.data?.pickup_scheduled_date) ||
    pickupDate;

  return {
    success: true,
    pickup_scheduled_date: scheduledDate,
    pickup_token: String(resp.pickup_token_number ?? ""),
  };
}
