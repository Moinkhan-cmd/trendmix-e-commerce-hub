import React from "react";
import { describe, expect, it, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ShopProvider, useShop } from "./shop";

function wrapper({ children }: { children: React.ReactNode }) {
  return <ShopProvider>{children}</ShopProvider>;
}

describe("shop store", () => {
  beforeEach(() => {
    // isolate persisted state between tests
    localStorage.clear();
  });

  it("adds to cart and updates count/subtotal", () => {
    const { result } = renderHook(() => useShop(), { wrapper });

    act(() => {
      result.current.addToCart({ id: "1", name: "Test", price: 100, image: "x" }, 2);
    });

    expect(result.current.cartCount).toBe(2);
    expect(result.current.subtotal).toBe(200);
    expect(result.current.cartItems[0].qty).toBe(2);
  });

  it("toggles wishlist", () => {
    const { result } = renderHook(() => useShop(), { wrapper });

    act(() => {
      result.current.toggleWishlist({ id: "1", name: "Test", price: 100, image: "x" });
    });

    expect(result.current.wishlistCount).toBe(1);
    expect(result.current.isWishlisted("1")).toBe(true);

    act(() => {
      result.current.toggleWishlist({ id: "1", name: "Test", price: 100, image: "x" });
    });

    expect(result.current.wishlistCount).toBe(0);
    expect(result.current.isWishlisted("1")).toBe(false);
  });
});

