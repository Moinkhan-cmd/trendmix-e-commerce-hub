/**
 * Shared TypeScript interfaces and types for all Shiprocket modules.
 * These are used across auth, serviceability, shipment, pickup, cancellation,
 * and webhook modules to ensure consistent data shapes.
 */

// ─── Payment ─────────────────────────────────────────────────
export type ShiprocketPaymentMethod = "COD" | "Prepaid";

// ─── Serviceability ──────────────────────────────────────────
/**
 * A single courier returned by the Shiprocket serviceability check.
 */
export interface ShiprocketCourierOption {
  /** Courier ID (used internally by Shiprocket) */
  id: number;
  /** Human-readable courier name e.g. "Delhivery", "Blue Dart" */
  courier_name: string;
  /** Estimated delivery window e.g. "2-3 Days" or a number */
  estimated_delivery_days: string | number;
  /** 1 = COD supported, 0 = not supported */
  cod: number;
  /** Shipping charge for this courier */
  rate: number;
}

/**
 * Result returned to the frontend from the serviceability check.
 * Token is never exposed here.
 */
export interface ServiceabilityResult {
  is_serviceable: boolean;
  estimated_delivery_days: string | null;
  cod_available: boolean;
  /** Top-5 sorted courier options (fastest first) */
  courier_options: ShiprocketCourierOption[];
}

// ─── Shipment fields saved to Firestore ──────────────────────
/**
 * All Shiprocket fields that are written to the "orders" collection
 * after a successful shipment creation.
 */
export interface ShiprocketOrderFields {
  /** Shiprocket's own order ID */
  shiprocket_order_id: string;
  /** Shipment ID (internal Shiprocket ID, used for pickup scheduling) */
  shipment_id: string;
  /** Air Waybill number – used for tracking */
  awb_code: string;
  /** Courier company name assigned to this shipment */
  courier_name: string;
  /** Public tracking URL for the customer */
  tracking_url: string;
  /** Internal shipment lifecycle status */
  shipment_status: ShipmentStatus;
  /** Payment status: "paid" | "pending" | "failed" */
  payment_status: string;
}

/**
 * All possible values for the `shipment_status` field in Firestore.
 */
export type ShipmentStatus =
  | "created"
  | "creation_failed"
  | "pickup_scheduled"
  | "pickup_failed"
  | "Shipped"
  | "In Transit"
  | "Out for Delivery"
  | "Delivered"
  | "Cancelled"
  | "cancelled"
  | "RTO"
  | "RTO Delivered"
  | "Lost"
  | "Damaged"
  | "failed_delivery"
  | "rto_initiated"
  | "rto_in_transit"
  | "rto_delivered"
  | "unknown";

// ─── Pickup ──────────────────────────────────────────────────
export interface PickupScheduleResult {
  success: boolean;
  pickup_scheduled_date?: string;
  pickup_token?: string;
  error?: string;
}

// ─── Cancellation ────────────────────────────────────────────
export interface CancellationResult {
  success: boolean;
  message: string;
}

// ─── Webhook ─────────────────────────────────────────────────
/**
 * The shape of the JSON body that Shiprocket sends to our webhook endpoint.
 * Not all fields are always present; treat everything as optional except `awb`.
 */
export interface ShiprocketWebhookPayload {
  /** Air Waybill – primary identifier */
  awb: string;
  /** Shiprocket order ID */
  order_id?: string | number;
  /** Shiprocket shipment ID */
  shipment_id?: string | number;
  /** Current status code or label sent by Shiprocket */
  current_status?: string;
  /** Timestamp of the status update */
  current_timestamp?: string;
  /** Date of delivery (populated when status is Delivered) */
  delivered_date?: string;
  /** Last known location of the package */
  location?: string;
  /** Estimated time of delivery */
  etd?: string;
}
