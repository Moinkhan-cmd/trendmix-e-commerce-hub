import { createContext } from "react";
import type { CartItem, ShopProduct } from "./shop-types";

export type ShopState = {
  cart: Record<string, CartItem>;
  wishlist: Record<string, ShopProduct>;
};

export type ShopContextValue = {
  state: ShopState;
  cartCount: number;
  wishlistCount: number;
  cartItems: CartItem[];
  wishlistItems: ShopProduct[];
  subtotal: number;
  addToCart: (product: ShopProduct, qty?: number) => void;
  removeFromCart: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  toggleWishlist: (product: ShopProduct) => void;
  isWishlisted: (productId: string) => boolean;
  clearWishlist: () => void;
};

export const ShopContext = createContext<ShopContextValue | null>(null);

