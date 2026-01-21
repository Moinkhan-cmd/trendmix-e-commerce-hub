import type { Timestamp } from "firebase/firestore";

export type OrderStatus = "Pending" | "Confirmed" | "Shipped" | "Delivered" | "Cancelled";

export type CategoryDoc = {
  name: string;
  slug: string;
  imageUrl: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type ProductSpecificationItem = {
  label: string;
  value: string;
};

export type ProductSpecificationSection = {
  title: string;
  items: ProductSpecificationItem[];
};

export type ProductDoc = {
  name: string;
  price: number;
  compareAtPrice?: number;
  sku?: string;
  brand?: string;
  gender?: "male" | "female" | "unisex";
  tags?: string[];
  weightKg?: number;
  dimensionsCm?: {
    length?: number;
    width?: number;
    height?: number;
  };
  featured?: boolean;
  categoryId: string;
  categorySlug: string;
  description: string;
  stock: number;
  imageUrls: string[];
  /** Optional structured specs shown on product detail page */
  specifications?: ProductSpecificationSection[];
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

/** Order timeline event */
export type OrderTimelineEvent = {
  status: OrderStatus;
  timestamp: Timestamp;
  note?: string;
  updatedBy?: string;
};

/** Payment information */
export type PaymentInfo = {
  method: "cod" | "online" | "upi";
  status: "pending" | "completed" | "failed" | "refunded";
  transactionId?: string;
  paidAt?: Timestamp;
};

export type OrderDoc = {
  items: OrderItem[];
  customer: CustomerInfo;
  status: OrderStatus;
  total: number;
  subtotal: number;
  shipping: number;
  discount?: number;
  couponCode?: string;
  orderNumber: string;
  userId: string;
  emailSent?: boolean;
  customerEmailSent?: boolean;
  timeline?: OrderTimelineEvent[];
  payment?: PaymentInfo;
  trackingNumber?: string;
  shippingCarrier?: string;
  estimatedDelivery?: Timestamp;
  cancellationReason?: string;
  adminNotes?: string;
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

export type NotificationSettingsDoc = {
  adminEmail: string;
  emailjsServiceId?: string;
  emailjsTemplateId?: string;
  emailjsPublicKey?: string;
  notifyOnNewOrder: boolean;
  notifyOnStatusChange?: boolean;
  customerOrderConfirmationTemplateId?: string;
  customerStatusUpdateTemplateId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};
