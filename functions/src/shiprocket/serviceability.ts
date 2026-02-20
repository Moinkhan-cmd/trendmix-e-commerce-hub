/**
 * shiprocketServiceability
 * ────────────────────────
 * Checks whether Shiprocket can deliver to a given pincode.
 *
 * Flow:
 *   1. getShiprocketBearerToken() – reuses cached token; re-logins only on expiry.
 *   2. Calls GET /v1/external/courier/serviceability/ with pickup + delivery details.
 *   3. Returns a clean ServiceabilityResult (no token ever exposed).
 *
 * Required env var:
 *   SHIPROCKET_PICKUP_POSTCODE – your warehouse/pickup pincode (6-digit string).
 */

import { getShiprocketBearerToken } from "./auth";
import type { ServiceabilityResult, ShiprocketCourierOption } from "./types";

const SERVICEABILITY_URL =
  "https://apiv2.shiprocket.in/v1/external/courier/serviceability/";

// ─── Helpers ─────────────────────────────────────────────────

function getPickupPostcode(): string {
  const val = process.env.SHIPROCKET_PICKUP_POSTCODE?.trim().replace(/^"|"$/g, "");
  if (!val) {
    throw new Error(
      "Missing required environment variable: SHIPROCKET_PICKUP_POSTCODE"
    );
  }
  return val;
}

/**
 * Parse "2-3 Days", "4", 3, etc. into a number for sorting.
 * Returns 99 when parsing fails.
 */
function parseEstimatedDays(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const match = value.match(/(\d+)/);
    if (match) return Number(match[1]);
  }
  return 99;
}

// ─── Raw Shiprocket API shape ─────────────────────────────────
interface RawCourier {
  id?: unknown;
  courier_name?: unknown;
  estimated_delivery_days?: unknown;
  cod?: unknown;
  rate?: unknown;
}

interface ServiceabilityApiResponse {
  status?: number;
  data?: {
    available_courier_companies?: RawCourier[];
  };
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Check whether Shiprocket can service a delivery pincode.
 *
 * @param deliveryPincode  6-digit delivery pincode entered by the customer.
 * @param weight           Package weight in kg (default: from env or 0.5 kg).
 * @param cod              1 = check for COD availability, 0 = prepaid only.
 */
export async function checkServiceability(
  deliveryPincode: string,
  weight: number,
  cod: 0 | 1
): Promise<ServiceabilityResult> {
  // ── Validate inputs ──────────────────────────────────────
  const cleanPincode = deliveryPincode.replace(/\D/g, "").slice(0, 6);
  if (cleanPincode.length !== 6) {
    return {
      is_serviceable: false,
      estimated_delivery_days: null,
      cod_available: false,
      courier_options: [],
    };
  }

  const safeWeight = Number.isFinite(weight) && weight > 0 ? weight : 0.5;

  // ── Fetch token (cached) ─────────────────────────────────
  const token = await getShiprocketBearerToken();
  const pickupPostcode = getPickupPostcode();

  const params = new URLSearchParams({
    pickup_postcode: pickupPostcode,
    delivery_postcode: cleanPincode,
    weight: String(safeWeight),
    cod: String(cod),
  });

  // ── Call Shiprocket API ──────────────────────────────────
  const response = await fetch(`${SERVICEABILITY_URL}?${params.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  // 422 = no couriers available (not an error, just not serviceable)
  if (response.status === 422 || response.status === 404) {
    return {
      is_serviceable: false,
      estimated_delivery_days: null,
      cod_available: false,
      courier_options: [],
    };
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Shiprocket serviceability check failed (${response.status}): ${errorBody.slice(0, 300)}`
    );
  }

  const data = (await response.json()) as ServiceabilityApiResponse;
  const companies = data?.data?.available_courier_companies ?? [];

  if (companies.length === 0) {
    return {
      is_serviceable: false,
      estimated_delivery_days: null,
      cod_available: false,
      courier_options: [],
    };
  }

  // ── Process results ──────────────────────────────────────
  // Sort fastest first
  const sorted = [...companies].sort(
    (a, b) =>
      parseEstimatedDays(a.estimated_delivery_days) -
      parseEstimatedDays(b.estimated_delivery_days)
  );

  const fastest = sorted[0];
  const codAvailable = companies.some((c) => Number(c.cod ?? 0) === 1);

  const courierOptions: ShiprocketCourierOption[] = sorted
    .slice(0, 5) // expose top-5 options to frontend
    .map((c) => {
      const rawEdd = c.estimated_delivery_days;
      const edd: string | number =
        typeof rawEdd === "number"
          ? rawEdd
          : typeof rawEdd === "string"
          ? rawEdd
          : "N/A";
      return {
        id: Number(c.id ?? 0),
        courier_name: String(c.courier_name ?? "Unknown"),
        estimated_delivery_days: edd,
        cod: Number(c.cod ?? 0),
        rate: Number(c.rate ?? 0),
      };
    });

  return {
    is_serviceable: true,
    estimated_delivery_days: String(fastest.estimated_delivery_days ?? "3-5 Days"),
    cod_available: codAvailable,
    courier_options: courierOptions,
  };
}
