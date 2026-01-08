/* eslint-disable react-refresh/only-export-components */
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem, ShopProduct } from "./shop-types";
import { ShopContext } from "./shop-context";

type ShopState = {
  cart: Record<string, CartItem>;
  wishlist: Record<string, ShopProduct>;
};

const SHOP_STORAGE_KEY = "trendmix.shop.v1";

function safeParseShopState(raw: string | null): ShopState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ShopState>;
    return {
      cart: (parsed.cart ?? {}) as ShopState["cart"],
      wishlist: (parsed.wishlist ?? {}) as ShopState["wishlist"],
    };
  } catch {
    return null;
  }
}

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ShopState>(() => {
    try {
      const raw = globalThis?.localStorage?.getItem(SHOP_STORAGE_KEY) ?? null;
      return safeParseShopState(raw) ?? { cart: {}, wishlist: {} };
    } catch {
      return { cart: {}, wishlist: {} };
    }
  });

  useEffect(() => {
    try {
      globalThis?.localStorage?.setItem(SHOP_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage errors (private mode, quota, etc.)
    }
  }, [state]);

  const addToCart = useCallback((product: ShopProduct, qty: number = 1) => {
    const safeQty = Number.isFinite(qty) ? Math.max(1, Math.floor(qty)) : 1;
    setState((prev) => {
      const existing = prev.cart[product.id];
      const nextQty = (existing?.qty ?? 0) + safeQty;
      return {
        ...prev,
        cart: {
          ...prev.cart,
          [product.id]: { product, qty: nextQty },
        },
      };
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setState((prev) => {
      if (!prev.cart[productId]) return prev;
      const next = { ...prev.cart };
      delete next[productId];
      return { ...prev, cart: next };
    });
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setState((prev) => {
      const existing = prev.cart[productId];
      if (!existing) return prev;
      const safeQty = Number.isFinite(qty) ? Math.max(1, Math.floor(qty)) : 1;
      return {
        ...prev,
        cart: {
          ...prev.cart,
          [productId]: { ...existing, qty: safeQty },
        },
      };
    });
  }, []);

  const clearCart = useCallback(() => {
    setState((prev) => ({ ...prev, cart: {} }));
  }, []);

  const toggleWishlist = useCallback((product: ShopProduct) => {
    setState((prev) => {
      const next = { ...prev.wishlist };
      if (next[product.id]) {
        delete next[product.id];
      } else {
        next[product.id] = product;
      }
      return { ...prev, wishlist: next };
    });
  }, []);

  const isWishlisted = useCallback(
    (productId: string) => {
      return Boolean(state.wishlist[productId]);
    },
    [state.wishlist],
  );

  const clearWishlist = useCallback(() => {
    setState((prev) => ({ ...prev, wishlist: {} }));
  }, []);

  const cartItems = useMemo(() => Object.values(state.cart), [state.cart]);
  const cartCount = useMemo(() => cartItems.reduce((sum, item) => sum + item.qty, 0), [cartItems]);
  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.qty * item.product.price, 0),
    [cartItems],
  );

  const wishlistItems = useMemo(() => Object.values(state.wishlist), [state.wishlist]);
  const wishlistCount = wishlistItems.length;

  const value = useMemo(
    () => ({
      state,
      cartItems,
      wishlistItems,
      cartCount,
      wishlistCount,
      subtotal,
      addToCart,
      removeFromCart,
      setQty,
      clearCart,
      toggleWishlist,
      isWishlisted,
      clearWishlist,
    }),
    [
      state,
      cartItems,
      wishlistItems,
      cartCount,
      wishlistCount,
      subtotal,
      addToCart,
      removeFromCart,
      setQty,
      clearCart,
      toggleWishlist,
      isWishlisted,
      clearWishlist,
    ],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used within <ShopProvider>");
  return ctx;
}

export type { ShopProduct, CartItem };
