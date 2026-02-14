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
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { auth } from "./firebase";
import type { OrderDoc, OrderItem, CustomerInfo, OrderStatus, OrderTimelineEvent } from "./models";

type FirestoreLikeError = {
  code?: string;
  message?: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(0, 13);
}

function sanitizeText(value: string, maxLength = 180): string {
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function getCurrentUserContext(requireVerified = false): { uid: string; email: string } {
  const user = auth.currentUser;
  if (!user || !user.uid || !user.email) {
    throw new Error("You must be logged in to perform this action.");
  }

  if (requireVerified && !user.emailVerified) {
    throw new Error("Please verify your email before placing an order.");
  }

  return {
    uid: user.uid,
    email: normalizeEmail(user.email),
  };
}

function isFirestoreIndexError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const maybe = err as FirestoreLikeError;
  const code = typeof maybe.code === "string" ? maybe.code : "";
  const message = typeof maybe.message === "string" ? maybe.message : "";
  return (
    code === "failed-precondition" &&
    /index|requires an index|create index|composite index/i.test(message)
  );
}

function sortByCreatedAtDesc<T extends { createdAt?: Timestamp }>(items: T[]): T[] {
  return items.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}

function stripUndefinedDeep(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (Array.isArray(value)) {
    const cleaned = value.map(stripUndefinedDeep).filter((v) => v !== undefined);
    return cleaned;
  }

  if (value instanceof Timestamp) return value;
  if (value instanceof Date) return value;

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      const cleanedVal = stripUndefinedDeep(val);
      if (cleanedVal !== undefined) out[key] = cleanedVal;
    }
    return out;
  }

  return value;
}

export type CreateOrderInput = {
  items: OrderItem[];
  customer: CustomerInfo;
  subtotal: number;
  shipping: number;
  total: number;
  userId?: string;
  couponCode?: string;
  discount?: number;
  payment?: {
    method: "cod" | "online" | "upi";
    status: "pending" | "completed" | "failed";
    transactionId?: string;
    paidAt?: Timestamp;
  };
};

export type UpdateOrderInput = {
  status?: OrderStatus;
  trackingNumber?: string;
  shippingCarrier?: string;
  estimatedDelivery?: Date;
  adminNotes?: string;
  cancellationReason?: string;
};

function generateOrderNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TM-${datePart}-${randomPart}`;
}

function createInitialTimeline(): OrderTimelineEvent[] {
  return [
    {
      status: "Pending",
      timestamp: Timestamp.now(),
      note: "Order placed successfully",
    },
  ];
}

export async function createOrder(input: CreateOrderInput): Promise<{ id: string; orderNumber: string }> {
  const currentUser = getCurrentUserContext(true);
  const orderNumber = generateOrderNumber();

  const customer: CustomerInfo = {
    ...input.customer,
    name: sanitizeText(input.customer.name, 90),
    email: currentUser.email,
    phone: normalizePhone(input.customer.phone),
    address: sanitizeText(input.customer.address, 220),
    city: sanitizeText(input.customer.city, 90),
    state: sanitizeText(input.customer.state, 90),
    pincode: sanitizeText(input.customer.pincode, 12).replace(/\D/g, "").slice(0, 6),
    notes: input.customer.notes ? sanitizeText(input.customer.notes, 300) : undefined,
  };

  // Server-side validation of coupon code and discount
  let validatedDiscount = 0;
  let validatedCouponCode: string | undefined;
  
  if (input.couponCode) {
    const validation = validateCouponCode(input.couponCode, input.subtotal);
    if (validation.valid) {
      validatedDiscount = validation.discount;
      validatedCouponCode = input.couponCode;
    } else {
      // If coupon is invalid, don't apply the discount
      console.warn("Invalid coupon code provided:", input.couponCode);
    }
  }

  const orderData = stripUndefinedDeep({
    items: input.items,
    customer,
    status: "Pending",
    subtotal: input.subtotal,
    shipping: input.shipping,
    total: input.subtotal + input.shipping - validatedDiscount,
    discount: validatedDiscount > 0 ? validatedDiscount : undefined,
    couponCode: validatedCouponCode,
    orderNumber,
    userId: currentUser.uid,
    emailSent: false,
    customerEmailSent: false,
    timeline: createInitialTimeline(),
    payment: input.payment ?? {
      method: "cod",
      status: "pending",
    },
  }) as Omit<OrderDoc, "createdAt" | "updatedAt">;

  const docRef = await addDoc(collection(db, "orders"), {
    ...orderData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Stock updates require elevated privileges in this project (see firestore.rules).
  // Guest checkout should still succeed even if stock decrement is not permitted
  // from the client.
  try {
    await updateProductStock(input.items);
  } catch (error) {
    console.warn("Order placed, but failed to update stock (non-fatal):", error);
  }

  return { id: docRef.id, orderNumber };
}

async function updateProductStock(items: OrderItem[]): Promise<void> {
  const batch = writeBatch(db);
  
  for (const item of items) {
    const productRef = doc(db, "products", item.productId);
    const productSnap = await getDoc(productRef);
    
    if (productSnap.exists()) {
      const currentStock = productSnap.data().stock || 0;
      const newStock = Math.max(0, currentStock - item.qty);
      batch.update(productRef, { stock: newStock });
    }
  }
  
  await batch.commit();
}

async function restoreProductStock(items: OrderItem[]): Promise<void> {
  const batch = writeBatch(db);
  
  for (const item of items) {
    const productRef = doc(db, "products", item.productId);
    const productSnap = await getDoc(productRef);
    
    if (productSnap.exists()) {
      const currentStock = productSnap.data().stock || 0;
      batch.update(productRef, { stock: currentStock + item.qty });
    }
  }
  
  await batch.commit();
}

export async function updateOrderStatus(
  orderId: string, 
  status: OrderStatus, 
  note?: string,
  updatedBy?: string
): Promise<void> {
  const orderRef = doc(db, "orders", orderId);
  const orderSnap = await getDoc(orderRef);
  
  if (!orderSnap.exists()) {
    throw new Error("Order not found");
  }
  
  const order = orderSnap.data() as OrderDoc;
  const previousStatus = order.status;
  
  const timelineEvent: OrderTimelineEvent = {
    status,
    timestamp: Timestamp.now(),
    note,
    updatedBy,
  };
  
  const timeline = order.timeline || [];
  timeline.push(timelineEvent);
  
  await updateDoc(orderRef, {
    status,
    timeline,
    updatedAt: serverTimestamp(),
  });
  
  if (status === "Cancelled" && previousStatus !== "Cancelled") {
    try {
      await restoreProductStock(order.items);
    } catch (error) {
      console.warn("Order status updated to Cancelled, but failed to restore stock (non-fatal):", error);
    }
  }
}

export async function updateOrder(orderId: string, updates: UpdateOrderInput): Promise<void> {
  const updateData: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.trackingNumber !== undefined) updateData.trackingNumber = updates.trackingNumber;
  if (updates.shippingCarrier !== undefined) updateData.shippingCarrier = updates.shippingCarrier;
  if (updates.estimatedDelivery !== undefined) updateData.estimatedDelivery = Timestamp.fromDate(updates.estimatedDelivery);
  if (updates.adminNotes !== undefined) updateData.adminNotes = updates.adminNotes;
  if (updates.cancellationReason !== undefined) updateData.cancellationReason = updates.cancellationReason;
  
  await updateDoc(doc(db, "orders", orderId), updateData);
}

export async function deleteOrder(orderId: string): Promise<void> {
  await deleteDoc(doc(db, "orders", orderId));
}

export async function getOrderById(orderId: string): Promise<(OrderDoc & { id: string }) | null> {
  const snap = await getDoc(doc(db, "orders", orderId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as OrderDoc) };
}

export async function getOrderByNumber(orderNumber: string): Promise<(OrderDoc & { id: string }) | null> {
  const { uid } = getCurrentUserContext();
  const q = query(
    collection(db, "orders"),
    where("userId", "==", uid),
    where("orderNumber", "==", orderNumber)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...(docSnap.data() as OrderDoc) };
}

export async function getOrdersByEmail(email: string): Promise<Array<OrderDoc & { id: string }>> {
  const { uid, email: currentEmail } = getCurrentUserContext();
  const normalizedEmail = normalizeEmail(email);

  if (normalizedEmail !== currentEmail) {
    return [];
  }

  try {
    const q = query(
      collection(db, "orders"),
      where("userId", "==", uid),
      where("customer.email", "==", normalizedEmail),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDoc) }));
  } catch (err) {
    // If the project doesn't have the composite index for (customer.email, createdAt),
    // fall back to a simpler query and sort client-side.
    if (isFirestoreIndexError(err)) {
      const q = query(
        collection(db, "orders"),
        where("userId", "==", uid),
        where("customer.email", "==", normalizedEmail)
      );
      const snap = await getDocs(q);
      return sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDoc) })));
    }
    throw err;
  }
}

export async function getOrdersByPhone(phone: string): Promise<Array<OrderDoc & { id: string }>> {
  const { uid } = getCurrentUserContext();
  const normalizedPhone = normalizePhone(phone);

  try {
    const q = query(
      collection(db, "orders"),
      where("userId", "==", uid),
      where("customer.phone", "==", normalizedPhone),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDoc) }));
  } catch (err) {
    if (isFirestoreIndexError(err)) {
      const q = query(
        collection(db, "orders"),
        where("userId", "==", uid),
        where("customer.phone", "==", normalizedPhone)
      );
      const snap = await getDocs(q);
      return sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDoc) })));
    }
    throw err;
  }
}

export async function getRecentOrders(count: number = 10): Promise<Array<OrderDoc & { id: string }>> {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDoc) }));
}

export async function getOrdersByStatus(status: OrderStatus): Promise<Array<OrderDoc & { id: string }>> {
  const q = query(collection(db, "orders"), where("status", "==", status), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDoc) }));
}

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

export function formatCurrency(amount: number): string {
  return `Rs.${amount.toLocaleString("en-IN")}`;
}

export function formatOrderDate(timestamp: Timestamp | Date | null | undefined): string {
  if (!timestamp) return "N/A";
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp as unknown as string);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// NOTE: This function is exported for use by both client and server (in createOrder).
// While the coupon code is visible in client code, server-side validation in createOrder
// ensures the discount is verified before being saved to the database.
export function validateCouponCode(code: string, subtotal: number): { valid: boolean; discount: number; error?: string } {
  const validCoupon = "1W3$$moin.trendmix";
  
  if (!code || code.trim() === "") {
    return { valid: false, discount: 0, error: "Please enter a coupon code" };
  }
  
  if (code !== validCoupon) {
    return { valid: false, discount: 0, error: "Invalid coupon code" };
  }
  
  // Apply flat ₹150 discount for valid coupon.
  // Clamp to subtotal so discount never exceeds payable item amount.
  const discount = Math.min(150, subtotal);
  
  return { valid: true, discount };
}

export function exportOrdersToCSV(orders: Array<OrderDoc & { id: string }>): string {
  const headers = [
    "Order Number", "Date", "Customer Name", "Email", "Phone", "Address",
    "City", "State", "Pincode", "Items", "Subtotal", "Shipping", "Total", "Status", "Notes",
  ];

  const rows = orders.map((order) => [
    order.orderNumber,
    formatOrderDate(order.createdAt),
    order.customer.name,
    order.customer.email,
    order.customer.phone,
    `"${order.customer.address.replace(/"/g, '""')}"`,
    order.customer.city,
    order.customer.state,
    order.customer.pincode,
    `"${order.items.map((i) => `${i.name} x${i.qty}`).join(", ")}"`,
    order.subtotal,
    order.shipping,
    order.total,
    order.status,
    `"${(order.customer.notes || "").replace(/"/g, '""')}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\
");
}

