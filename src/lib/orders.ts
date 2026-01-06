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
import type { OrderDoc, OrderItem, CustomerInfo, OrderStatus, OrderTimelineEvent } from "./models";

export type CreateOrderInput = {
  items: OrderItem[];
  customer: CustomerInfo;
  subtotal: number;
  shipping: number;
  total: number;
  userId?: string;
  couponCode?: string;
  discount?: number;
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
  const orderNumber = generateOrderNumber();

  const orderData: Omit<OrderDoc, "createdAt" | "updatedAt"> = {
    items: input.items,
    customer: input.customer,
    status: "Pending",
    subtotal: input.subtotal,
    shipping: input.shipping,
    total: input.total,
    discount: input.discount,
    couponCode: input.couponCode,
    orderNumber,
    userId: input.userId ?? "guest",
    emailSent: false,
    customerEmailSent: false,
    timeline: createInitialTimeline(),
    payment: {
      method: "cod",
      status: "pending",
    },
  };

  const docRef = await addDoc(collection(db, "orders"), {
    ...orderData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateProductStock(input.items);

  Promise.all([
    sendOrderNotificationEmail(docRef.id, orderData),
    sendCustomerConfirmationEmail(docRef.id, orderData),
  ]).catch(console.error);

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
    await restoreProductStock(order.items);
  }
  
  sendStatusUpdateEmail(orderId, { ...order, status }).catch(console.error);
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
  const q = query(collection(db, "orders"), where("orderNumber", "==", orderNumber));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...(docSnap.data() as OrderDoc) };
}

export async function getOrdersByEmail(email: string): Promise<Array<OrderDoc & { id: string }>> {
  const q = query(
    collection(db, "orders"),
    where("customer.email", "==", email.toLowerCase()),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDoc) }));
}

export async function getOrdersByPhone(phone: string): Promise<Array<OrderDoc & { id: string }>> {
  const normalizedPhone = phone.replace(/\D/g, "").slice(-10);
  const q = query(
    collection(db, "orders"),
    where("customer.phone", "==", normalizedPhone),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDoc) }));
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

async function sendOrderNotificationEmail(
  orderId: string,
  order: Omit<OrderDoc, "createdAt" | "updatedAt">
): Promise<void> {
  try {
    const settingsSnap = await getDoc(doc(db, "settings", "notifications"));
    if (!settingsSnap.exists()) return;

    const settings = settingsSnap.data();
    if (!settings.notifyOnNewOrder) return;

    const { emailjsServiceId, emailjsTemplateId, emailjsPublicKey, adminEmail } = settings;
    if (!emailjsServiceId || !emailjsTemplateId || !emailjsPublicKey || !adminEmail) return;

    const itemsList = order.items
      .map((item) => `${item.name} x${item.qty} - Rs.${(item.price * item.qty).toLocaleString("en-IN")}`)
      .join("\
");

    const emailParams = {
      to_email: adminEmail,
      order_number: order.orderNumber,
      customer_name: order.customer.name,
      customer_email: order.customer.email,
      customer_phone: order.customer.phone,
      customer_address: `${order.customer.address}, ${order.customer.city}, ${order.customer.state} - ${order.customer.pincode}`,
      items_list: itemsList,
      subtotal: `Rs.${order.subtotal.toLocaleString("en-IN")}`,
      shipping: order.shipping === 0 ? "Free" : `Rs.${order.shipping.toLocaleString("en-IN")}`,
      total: `Rs.${order.total.toLocaleString("en-IN")}`,
      notes: order.customer.notes || "No notes",
      order_date: new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" }),
    };

    const emailjs = await import("@emailjs/browser");
    await emailjs.send(emailjsServiceId, emailjsTemplateId, emailParams, emailjsPublicKey);
    await updateDoc(doc(db, "orders", orderId), { emailSent: true });
  } catch (error) {
    console.error("Failed to send admin notification email:", error);
  }
}

async function sendCustomerConfirmationEmail(
  orderId: string,
  order: Omit<OrderDoc, "createdAt" | "updatedAt">
): Promise<void> {
  try {
    const settingsSnap = await getDoc(doc(db, "settings", "notifications"));
    if (!settingsSnap.exists()) return;

    const settings = settingsSnap.data();
    const { emailjsServiceId, customerOrderConfirmationTemplateId, emailjsPublicKey } = settings;
    if (!emailjsServiceId || !customerOrderConfirmationTemplateId || !emailjsPublicKey) return;

    const itemsList = order.items
      .map((item) => `${item.name} x${item.qty} - Rs.${(item.price * item.qty).toLocaleString("en-IN")}`)
      .join("\
");

    const emailParams = {
      to_email: order.customer.email,
      to_name: order.customer.name,
      order_number: order.orderNumber,
      items_list: itemsList,
      subtotal: `Rs.${order.subtotal.toLocaleString("en-IN")}`,
      shipping: order.shipping === 0 ? "Free" : `Rs.${order.shipping.toLocaleString("en-IN")}`,
      total: `Rs.${order.total.toLocaleString("en-IN")}`,
      delivery_address: `${order.customer.address}, ${order.customer.city}, ${order.customer.state} - ${order.customer.pincode}`,
      order_date: new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" }),
    };

    const emailjs = await import("@emailjs/browser");
    await emailjs.send(emailjsServiceId, customerOrderConfirmationTemplateId, emailParams, emailjsPublicKey);
    await updateDoc(doc(db, "orders", orderId), { customerEmailSent: true });
  } catch (error) {
    console.error("Failed to send customer confirmation email:", error);
  }
}

async function sendStatusUpdateEmail(orderId: string, order: OrderDoc): Promise<void> {
  try {
    const settingsSnap = await getDoc(doc(db, "settings", "notifications"));
    if (!settingsSnap.exists()) return;

    const settings = settingsSnap.data();
    if (!settings.notifyOnStatusChange) return;

    const { emailjsServiceId, customerStatusUpdateTemplateId, emailjsPublicKey } = settings;
    if (!emailjsServiceId || !customerStatusUpdateTemplateId || !emailjsPublicKey) return;

    const statusMessages: Record<OrderStatus, string> = {
      Pending: "Your order has been received and is being processed.",
      Confirmed: "Great news! Your order has been confirmed and is being prepared.",
      Shipped: `Your order is on its way! ${order.trackingNumber ? `Tracking: ${order.trackingNumber}` : ""}`,
      Delivered: "Your order has been delivered. Thank you for shopping with us!",
      Cancelled: `Your order has been cancelled. ${order.cancellationReason || ""}`,
    };

    const emailParams = {
      to_email: order.customer.email,
      to_name: order.customer.name,
      order_number: order.orderNumber,
      order_status: order.status,
      status_message: statusMessages[order.status],
      tracking_number: order.trackingNumber || "N/A",
      shipping_carrier: order.shippingCarrier || "N/A",
    };

    const emailjs = await import("@emailjs/browser");
    await emailjs.send(emailjsServiceId, customerStatusUpdateTemplateId, emailParams, emailjsPublicKey);
  } catch (error) {
    console.error("Failed to send status update email:", error);
  }
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

