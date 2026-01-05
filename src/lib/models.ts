import type { Timestamp } from "firebase/firestore";

export type OrderStatus = "Pending" | "Shipped" | "Delivered" | "Cancelled";

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

export type OrderDoc = {
  userId: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
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
