/**
 * Shiprocket frontend API client.
 * Calls Firebase Cloud Functions – never exposes Shiprocket credentials.
 */

import { auth } from "./firebase";

const FUNCTIONS_BASE_URL =
  import.meta.env.VITE_FIREBASE_FUNCTIONS_URL ||
  "https://us-central1-trendmix-admin.cloudfunctions.net";

const CHECK_SERVICEABILITY_URL = `${FUNCTIONS_BASE_URL}/checkShiprocketServiceability`;
const CANCEL_ORDER_URL = `${FUNCTIONS_BASE_URL}/cancelShiprocketOrder`;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type CourierOption = {
  courier_name: string;
  rate: number;
  etd: string;          // estimated delivery date
  cod: boolean;
  estimated_delivery_days: number;
};

export type ServiceabilityResult = {
  is_serviceable: boolean;
  estimated_delivery_days: number | null;
  cod_available: boolean;
  courier_options: CourierOption[];
};

export type CancelOrderResult = {
  success: boolean;
  message: string;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Get Firebase Auth idToken for authenticated calls. */
async function getIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be logged in");
  return user.getIdToken();
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Check if a pincode is serviceable for delivery.
 * No auth required – callable by anyone on the checkout page.
 */
export async function checkPincodeServiceability(
  pincode: string,
  weight: number = 0.5,
  cod: boolean = false,
): Promise<ServiceabilityResult> {
  const res = await fetch(CHECK_SERVICEABILITY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: { delivery_pincode: pincode, weight, cod },
    }),
  });

  const json = await res.json();

  if (!res.ok || json.error) {
    throw new Error(json.error?.message || json.message || "Serviceability check failed");
  }

  // Cloud Functions onCall wraps result in { result: ... }
  return json.result as ServiceabilityResult;
}

/**
 * Cancel a Shiprocket order / shipment.
 * Requires authenticated user who owns the order.
 */
export async function cancelOrder(orderId: string): Promise<CancelOrderResult> {
  const token = await getIdToken();

  const res = await fetch(CANCEL_ORDER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      data: { orderId },
    }),
  });

  const json = await res.json();

  if (!res.ok || json.error) {
    throw new Error(json.error?.message || json.message || "Cancellation failed");
  }

  return json.result as CancelOrderResult;
}
