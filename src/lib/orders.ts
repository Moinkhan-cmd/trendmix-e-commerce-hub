import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { OrderDoc, OrderItem, CustomerInfo, OrderStatus } from "./models";

export type CreateOrderInput = {
  items: OrderItem[];
  customer: CustomerInfo;
  subtotal: number;
  shipping: number;
  total: number;
  userId?: string;
};

/**
 * Generate a human-readable order number
 * Format: TM-YYYYMMDD-XXXX (e.g., TM-20260106-A1B2)
 */
function generateOrderNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TM-${datePart}-${randomPart}`;
}

/**
 * Create a new order
 */
export async function createOrder(input: CreateOrderInput): Promise<{ id: string; orderNumber: string }> {
  const orderNumber = generateOrderNumber();

  const orderData: Omit<OrderDoc, "createdAt" | "updatedAt"> = {
    items: input.items,
    customer: input.customer,
    status: "Pending",
    subtotal: input.subtotal,
    shipping: input.shipping,
    total: input.total,
    orderNumber,
    userId: input.userId ?? "guest",
    emailSent: false,
  };

  const docRef = await addDoc(collection(db, "orders"), {
    ...orderData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Try to send email notification (non-blocking)
  sendOrderNotificationEmail(docRef.id, orderData).catch(console.error);

  return { id: docRef.id, orderNumber };
}

/**
 * Update order status
 */
export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  await updateDoc(doc(db, "orders", orderId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete an order
 */
export async function deleteOrder(orderId: string): Promise<void> {
  await deleteDoc(doc(db, "orders", orderId));
}

/**
 * Get order by ID
 */
export async function getOrderById(orderId: string): Promise<(OrderDoc & { id: string }) | null> {
  const snap = await getDoc(doc(db, "orders", orderId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as OrderDoc) };
}

/**
 * Get order by order number
 */
export async function getOrderByNumber(orderNumber: string): Promise<(OrderDoc & { id: string }) | null> {
  const q = query(collection(db, "orders"), where("orderNumber", "==", orderNumber));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...(docSnap.data() as OrderDoc) };
}

/**
 * Send email notification to admin about new order
 * Uses EmailJS for client-side email sending
 */
async function sendOrderNotificationEmail(
  orderId: string,
  order: Omit<OrderDoc, "createdAt" | "updatedAt">
): Promise<void> {
  try {
    // Get notification settings from Firestore
    const settingsSnap = await getDoc(doc(db, "settings", "notifications"));
    if (!settingsSnap.exists()) {
      console.log("No notification settings configured");
      return;
    }

    const settings = settingsSnap.data();
    if (!settings.notifyOnNewOrder) {
      console.log("Email notifications disabled");
      return;
    }

    const { emailjsServiceId, emailjsTemplateId, emailjsPublicKey, adminEmail } = settings;
    if (!emailjsServiceId || !emailjsTemplateId || !emailjsPublicKey || !adminEmail) {
      console.log("EmailJS not configured properly");
      return;
    }

    // Build email content
    const itemsList = order.items
      .map((item) => `${item.name} x${item.qty} - Rs.${(item.price * item.qty).toLocaleString("en-IN")}`)
      .join("\n");

    const emailParams = {
      to_email: adminEmail,
      order_number: order.orderNumber,
      customer_name: order.customer.name,
      customer_email: order.customer.email,
      customer_phone: order.customer.phone,
      customer_address: `${order.customer.address}, ${order.customer.city}, ${order.customer.state} - ${order.customer.pincode}`,
      items_list: itemsList,
      subtotal: `Rs.${order.subtotal.toLocaleString("en-IN")}`,
      shipping: `Rs.${order.shipping.toLocaleString("en-IN")}`,
      total: `Rs.${order.total.toLocaleString("en-IN")}`,
      notes: order.customer.notes || "No notes",
      order_date: new Date().toLocaleString("en-IN", {
        dateStyle: "long",
        timeStyle: "short",
      }),
    };

    // Dynamic import of emailjs to avoid loading it if not needed
    const emailjs = await import("@emailjs/browser");
    await emailjs.send(emailjsServiceId, emailjsTemplateId, emailParams, emailjsPublicKey);

    // Mark email as sent
    await updateDoc(doc(db, "orders", orderId), { emailSent: true });
    console.log("Order notification email sent successfully");
  } catch (error) {
    console.error("Failed to send order notification email:", error);
    // Don't throw - email failure shouldn't break order creation
  }
}

/**
 * Validate order items (check stock availability)
 */
export async function validateOrderItems(
  items: Array<{ productId: string; qty: number }>
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const item of items) {
    const productSnap = await getDoc(doc(db, "products", item.productId));
    if (!productSnap.exists()) {
      errors.push(`Product not found: ${item.productId}`);
      continue;
    }

    const product = productSnap.data();
    if (!product.published) {
      errors.push(`Product is not available: ${product.name}`);
      continue;
    }

    if (product.stock < item.qty) {
      errors.push(`Insufficient stock for ${product.name}. Available: ${product.stock}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return `Rs.${amount.toLocaleString("en-IN")}`;
}

/**
 * Format date for display
 */
export function formatOrderDate(timestamp: Timestamp | Date | null | undefined): string {
  if (!timestamp) return "N/A";
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp as any);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
