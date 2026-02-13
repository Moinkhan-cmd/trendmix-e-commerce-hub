const GUEST_CHECKOUT_KEY = "trendmix.checkout.guest";

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // no-op
  }
}

function removeStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // no-op
  }
}

export function enableGuestCheckout(): void {
  writeStorage(GUEST_CHECKOUT_KEY, "enabled");
}

export function disableGuestCheckout(): void {
  removeStorage(GUEST_CHECKOUT_KEY);
}

export function isGuestCheckoutEnabled(): boolean {
  return readStorage(GUEST_CHECKOUT_KEY) === "enabled";
}
