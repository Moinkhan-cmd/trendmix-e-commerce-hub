import * as admin from "firebase-admin";
import { getShiprocketBearerToken } from "./auth";
import { schedulePickup } from "./pickup";

const SHIPROCKET_CREATE_ADHOC_ORDER_URL = "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc";

type GenericRecord = Record<string, unknown>;

export type ShiprocketShipmentFields = {
  shiprocket_order_id: string;
  /** Internal Shiprocket shipment ID – used for pickup scheduling */
  shipment_id: string;
  awb_code: string;
  courier_name: string;
  tracking_url: string;
  shipment_status: "created" | "pickup_scheduled" | "pickup_failed" | "creation_failed";
  payment_status: string;
};

function asRecord(value: unknown): GenericRecord {
  return typeof value === "object" && value !== null ? (value as GenericRecord) : {};
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.trim();
}

function asNumber(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const clean = fullName.replace(/\s+/g, " ").trim();
  if (!clean) return { firstName: "Customer", lastName: "" };

  const parts = clean.split(" ");
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function toShiprocketMoney(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Number(num.toFixed(2));
}

function toIsoOrderDate(value: unknown): string {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date().toISOString();
}

export function deriveShiprocketPaymentMethod(orderData: GenericRecord): "COD" | "Prepaid" {
  const orderPaymentMethod = asString(orderData.paymentMethod).toUpperCase();
  if (orderPaymentMethod === "COD") return "COD";

  const payment = asRecord(orderData.payment);
  const paymentMethod = asString(payment.method).toUpperCase();
  return paymentMethod === "COD" ? "COD" : "Prepaid";
}

export function derivePaymentStatus(orderData: GenericRecord): string {
  const payment = asRecord(orderData.payment);
  const status = asString(payment.status).toLowerCase();

  if (status === "completed") return "paid";
  if (status === "failed") return "failed";
  if (deriveShiprocketPaymentMethod(orderData) === "COD") return "pending";

  return status || "pending";
}

function getDefaultWeightKg(): number {
  const raw = process.env.SHIPROCKET_DEFAULT_WEIGHT_KG;
  return asNumber(raw, 0.5);
}

function getDefaultLengthCm(): number {
  const raw = process.env.SHIPROCKET_DEFAULT_LENGTH_CM;
  return asNumber(raw, 20);
}

function getDefaultBreadthCm(): number {
  const raw = process.env.SHIPROCKET_DEFAULT_BREADTH_CM;
  return asNumber(raw, 20);
}

function getDefaultHeightCm(): number {
  const raw = process.env.SHIPROCKET_DEFAULT_HEIGHT_CM;
  return asNumber(raw, 10);
}

function getPickupLocation(): string {
  const raw = process.env.SHIPROCKET_PICKUP_LOCATION;
  return asString(raw, "Primary");
}

function getShiprocketPayload(orderId: string, orderData: GenericRecord): GenericRecord {
  const customer = asRecord(orderData.customer);
  const paymentMethod = deriveShiprocketPaymentMethod(orderData);
  const orderItemsRaw = Array.isArray(orderData.items) ? orderData.items : [];

  const customerName = asString(customer.name, "Customer");
  const nameParts = splitName(customerName);
  const totalAmount = toShiprocketMoney(orderData.finalAmount ?? orderData.total);

  const orderItems = orderItemsRaw.map((item, index) => {
    const entry = asRecord(item);
    const units = Math.max(1, Math.round(asNumber(entry.qty, 1)));
    return {
      name: asString(entry.name, `Item ${index + 1}`),
      sku: asString(entry.productId, `SKU-${index + 1}`),
      units,
      selling_price: toShiprocketMoney(entry.price),
    };
  });

  return {
    order_id: asString(orderData.orderNumber, orderId),
    order_date: toIsoOrderDate(orderData.createdAt),
    pickup_location: getPickupLocation(),
    billing_customer_name: nameParts.firstName,
    billing_last_name: nameParts.lastName,
    billing_address: asString(customer.address, "N/A"),
    billing_city: asString(customer.city, "N/A"),
    billing_pincode: asString(customer.pincode, "000000"),
    billing_state: asString(customer.state, "N/A"),
    billing_country: "India",
    billing_email: asString(customer.email, "no-reply@example.com"),
    billing_phone: asString(customer.phone, "9999999999"),
    shipping_is_billing: true,
    order_items: orderItems,
    payment_method: paymentMethod,
    sub_total: totalAmount,
    length: getDefaultLengthCm(),
    breadth: getDefaultBreadthCm(),
    height: getDefaultHeightCm(),
    weight: getDefaultWeightKg(),
  };
}

function extractShiprocketData(response: GenericRecord): {
  shiprocketOrderId: string;
  shipmentId: string;
  awbCode: string;
  courierName: string;
  trackingUrl: string;
} {
  // Shiprocket's order_id is their order identifier; shipment_id may be an array or scalar
  const shiprocketOrderId =
    asString(response.order_id) ||
    asString(response.orderId) ||
    "";

  // shipment_id can be an array like [12345] or a plain number/string
  const rawShipmentId = Array.isArray(response.shipment_id)
    ? response.shipment_id[0]
    : response.shipment_id;
  const shipmentId = asString(rawShipmentId);

  const awbCode = asString(response.awb_code);
  const courierName = asString(response.courier_name || response.courier_company_name);
  const trackingUrl = asString(response.tracking_url || response.shipment_track_url);

  return {
    shiprocketOrderId,
    shipmentId,
    awbCode,
    courierName,
    trackingUrl,
  };
}

async function createShiprocketAdhocOrder(orderId: string, orderData: GenericRecord): Promise<ShiprocketShipmentFields> {
  const token = await getShiprocketBearerToken();
  const payload = getShiprocketPayload(orderId, orderData);
  const paymentStatus = derivePaymentStatus(orderData);

  const response = await fetch(SHIPROCKET_CREATE_ADHOC_ORDER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const bodyText = await response.text();
  let parsedResponse: GenericRecord = {};
  try {
    parsedResponse = (JSON.parse(bodyText) as GenericRecord) ?? {};
  } catch {
    parsedResponse = {};
  }

  if (!response.ok) {
    throw new Error(
      `Shiprocket shipment creation failed (${response.status}): ${bodyText.slice(0, 500)}`
    );
  }

  const extracted = extractShiprocketData(parsedResponse);
  if (!extracted.shiprocketOrderId && !extracted.shipmentId) {
    throw new Error("Shiprocket response did not include order/shipment identifier.");
  }

  // ── Attempt automatic pickup scheduling ─────────────────
  // schedulePickup never throws – failures are captured in the result.
  let pickupStatus: "created" | "pickup_scheduled" | "pickup_failed" = "created";
  const pickupFields: GenericRecord = {};

  if (extracted.shipmentId) {
    const pickupResult = await schedulePickup(extracted.shipmentId);
    if (pickupResult.success) {
      pickupStatus = "pickup_scheduled";
      pickupFields.pickup_scheduled_date = pickupResult.pickup_scheduled_date ?? null;
      pickupFields.pickup_token = pickupResult.pickup_token ?? null;
      console.info("Shiprocket pickup scheduled", {
        shipmentId: extracted.shipmentId,
        date: pickupResult.pickup_scheduled_date,
      });
    } else {
      pickupStatus = "pickup_failed";
      pickupFields.pickup_error = pickupResult.error ?? "Pickup scheduling failed";
      console.error("Shiprocket pickup scheduling failed (non-fatal)", {
        shipmentId: extracted.shipmentId,
        error: pickupResult.error,
      });
    }
  }

  return {
    shiprocket_order_id: extracted.shiprocketOrderId,
    shipment_id: extracted.shipmentId,
    awb_code: extracted.awbCode,
    courier_name: extracted.courierName,
    tracking_url: extracted.trackingUrl,
    shipment_status: pickupStatus,
    payment_status: paymentStatus,
    ...pickupFields,
  } as ShiprocketShipmentFields & GenericRecord;
}

export async function syncShiprocketShipmentForOrder(
  orderRef: admin.firestore.DocumentReference,
  orderId: string,
  orderData: GenericRecord
): Promise<void> {
  if (asString(orderData.shiprocket_order_id)) {
    return;
  }

  try {
    const fields = await createShiprocketAdhocOrder(orderId, orderData);
    await orderRef.set(
      {
        ...fields,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    const paymentStatus = derivePaymentStatus(orderData);
    const message = error instanceof Error ? error.message : "Unknown Shiprocket error";

    console.error("Shiprocket shipment creation error", {
      orderId,
      message,
    });

    await orderRef.set(
      {
        shipment_status: "creation_failed",
        payment_status: paymentStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
}
