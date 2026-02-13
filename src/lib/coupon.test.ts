import { describe, it, expect, vi } from "vitest";
import { validateCheckoutCoupon } from "./coupon";

describe("Coupon Validation", () => {
  it("should validate the correct coupon code '1W3$$moin.trendmix'", async () => {
    // Mock fetch to simulate server error and fall back to client-side validation
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await validateCheckoutCoupon("1W3$$moin.trendmix");

    expect(result.valid).toBe(true);
    expect(result.discount).toBe(120);
    expect(result.message).toBe("Coupon applied.");
  });

  it("should reject an invalid coupon code", async () => {
    // Mock fetch to simulate server error and fall back to client-side validation
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await validateCheckoutCoupon("INVALID_CODE");

    expect(result.valid).toBe(false);
    expect(result.discount).toBe(0);
    expect(result.message).toBe("Invalid coupon code.");
  });

  it("should reject an empty coupon code", async () => {
    // Mock fetch to simulate server error and fall back to client-side validation
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await validateCheckoutCoupon("");

    expect(result.valid).toBe(false);
    expect(result.discount).toBe(0);
    expect(result.message).toBe("Coupon code is required.");
  });

  it("should trim whitespace from coupon code", async () => {
    // Mock fetch to simulate server error and fall back to client-side validation
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await validateCheckoutCoupon("  1W3$$moin.trendmix  ");

    expect(result.valid).toBe(true);
    expect(result.discount).toBe(120);
    expect(result.message).toBe("Coupon applied.");
  });
});
