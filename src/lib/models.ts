import type { Timestamp } from "firebase/firestore";

export type OrderStatus = "Pending" | "Confirmed" | "Shipped" | "Delivered" | "Cancelled";

export type CategoryDoc = {
  name: string;
  slug: string;
  imageUrl: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type ProductDoc = {
  name: string;
  price: number;
  categoryId: string;
  categorySlug: string;
  description: string;
  stock: number;
  imageUrls: string[];
  published: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type OrderItem = {
  productId: string;
  name: string;
  qty: number;
  price: number;
  imageUrl: string;
};

/** Customer info for the order */
export type CustomerInfo = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  notes?: string;
};

export type OrderDoc = {
  /** Items in the order */
  items: OrderItem[];
  /** Customer information */
  customer: CustomerInfo;
  /** Order status */
  status: OrderStatus;
  /** Total amount */
  total: number;
  /** Subtotal before any discounts */
  subtotal: number;
  /** Shipping cost */
  shipping: number;
  /** Order number (human readable) */
  orderNumber: string;
  /** User ID if logged in, or "guest" */
  userId: string;
  /** Email notification sent to admin */
  emailSent?: boolean;
  /** Timestamps */
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type UserDoc = {
  email: string;
  displayName?: string;
  blocked: boolean;
  createdAt?: Timestamp;
};

export type SocialLink = {
  url: string;
  label?: string;
  platform?: string;
};

export type PersonalProfileFeatured = {
  enabled: boolean;
  title: string;
  tagline: string;
  visible: boolean;
};

export type PersonalProfileDoc = {
  email: string;
  location: string;
  instagramId?: string;
  xId?: string;
  socialLinks: SocialLink[];
  bioHtml: string;
  photoUrl?: string;
  photoPath?: string;
  featured: PersonalProfileFeatured;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

/** Settings document for admin email notifications */
export type NotificationSettingsDoc = {
  adminEmail: string;
  emailjsServiceId?: string;
  emailjsTemplateId?: string;
  emailjsPublicKey?: string;
  notifyOnNewOrder: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};
