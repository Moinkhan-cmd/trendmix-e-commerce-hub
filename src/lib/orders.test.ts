import { describe, expect, it } from "vitest";
import { validateCouponCode } from "./orders";

describe("validateCouponCode", () => {
  it("accepts get10oFF and forces payable amount to ₹9", () => {
    const amountBeforeDiscount = 548;
    const result = validateCouponCode("get10oFF", amountBeforeDiscount);

    expect(result.valid).toBe(true);
    expect(result.discount).toBe(539);
    expect(amountBeforeDiscount - result.discount).toBe(9);
  });

  it("rejects the old coupon code", () => {
    const result = validateCouponCode("1W3$$moin.trendmix", 548);

    expect(result.valid).toBe(false);
    expect(result.discount).toBe(0);
  });

  it("keeps payable amount at ₹9 for very small totals", () => {
    const amountBeforeDiscount = 5;
    const result = validateCouponCode("get10oFF", amountBeforeDiscount);

    expect(result.valid).toBe(true);
    expect(amountBeforeDiscount - result.discount).toBe(9);
  });
});
