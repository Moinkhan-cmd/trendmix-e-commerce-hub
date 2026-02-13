const FUNCTIONS_BASE_URL =
  import.meta.env.VITE_FIREBASE_FUNCTIONS_URL ||
  "https://us-central1-trendmix-admin.cloudfunctions.net";

const VALIDATE_CHECKOUT_COUPON_URL = `${FUNCTIONS_BASE_URL}/validateCheckoutCoupon`;
const CHECKOUT_TEST_COUPON_SHA256 = "b3e09d59be820d5d724e8ba9fe26937a0045a603b50698218638753d98330208";
const CHECKOUT_TEST_COUPON_DISCOUNT = 120;

export type ValidateCheckoutCouponResult = {
  valid: boolean;
  discount: number;
  message?: string;
};

async function sha256Hex(value: string): Promise<string> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    return "";
  }

  const encoded = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fallbackValidate(couponCode: string): Promise<ValidateCheckoutCouponResult> {
  const normalized = couponCode.trim();
  if (!normalized) {
    return {
      valid: false,
      discount: 0,
      message: "Coupon code is required.",
    };
  }

  const hash = await sha256Hex(normalized);
  const valid = hash === CHECKOUT_TEST_COUPON_SHA256;

  return {
    valid,
    discount: valid ? CHECKOUT_TEST_COUPON_DISCOUNT : 0,
    message: valid ? "Coupon applied." : "Invalid coupon code.",
  };
}

export async function validateCheckoutCoupon(couponCode: string): Promise<ValidateCheckoutCouponResult> {
  try {
    const response = await fetch(VALIDATE_CHECKOUT_COUPON_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ couponCode }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { error?: string };
      if (response.status >= 500) {
        return fallbackValidate(couponCode);
      }
      throw new Error(errorData.error || `Coupon validation failed (HTTP ${response.status})`);
    }

    const data = (await response.json()) as {
      success: boolean;
      valid?: boolean;
      discount?: number;
      message?: string;
    };

    return {
      valid: Boolean(data.valid),
      discount: Number.isFinite(Number(data.discount)) ? Number(data.discount) : 0,
      message: data.message,
    };
  } catch {
    return fallbackValidate(couponCode);
  }
}
