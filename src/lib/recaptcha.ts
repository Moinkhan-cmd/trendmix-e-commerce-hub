const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
const FUNCTIONS_BASE_URL =
  import.meta.env.VITE_FIREBASE_FUNCTIONS_URL ||
  "https://us-central1-trendmix-admin.cloudfunctions.net";
const RECAPTCHA_ALLOW_NETWORK_BYPASS =
  import.meta.env.DEV || import.meta.env.VITE_RECAPTCHA_ALLOW_NETWORK_BYPASS === "true";
const RECAPTCHA_ALLOW_LOCALHOST_BYPASS =
  import.meta.env.DEV || import.meta.env.VITE_RECAPTCHA_ALLOW_LOCALHOST_BYPASS === "true";

const VERIFY_RECAPTCHA_URL = `${FUNCTIONS_BASE_URL}/verifyRecaptchaAssessment`;

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function isLocalhostRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

function canBypassForLocalhost(): boolean {
  return RECAPTCHA_ALLOW_LOCALHOST_BYPASS && isLocalhostRuntime();
}

function ensureRecaptchaConfigured(): string {
  if (!RECAPTCHA_SITE_KEY) {
    throw new Error("Security challenge is not configured. Please contact support.");
  }
  return RECAPTCHA_SITE_KEY;
}

function loadRecaptchaScript(siteKey: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("reCAPTCHA is only available in browser environments."));
  }

  if (window.grecaptcha) {
    return Promise.resolve();
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>("script[data-recaptcha='v3']");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load reCAPTCHA.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-recaptcha", "v3");

    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load reCAPTCHA."));

    document.head.appendChild(script);
  });

  return scriptPromise;
}

export async function getRecaptchaToken(action: "signup" | "login" | "checkout"): Promise<string> {
  if (canBypassForLocalhost()) {
    return `local_dev_bypass_token_${action}`;
  }

  const siteKey = ensureRecaptchaConfigured();
  await loadRecaptchaScript(siteKey);

  if (!window.grecaptcha) {
    throw new Error("Security challenge is unavailable. Please refresh and try again.");
  }

  return new Promise<string>((resolve, reject) => {
    window.grecaptcha?.ready(async () => {
      try {
        const token = await window.grecaptcha?.execute(siteKey, { action });
        if (!token) {
          reject(new Error("Failed to generate security verification token."));
          return;
        }
        resolve(token);
      } catch {
        reject(new Error("Failed to generate security verification token."));
      }
    });
  });
}

export async function verifyRecaptchaAssessment(token: string, action: "signup" | "login" | "checkout"): Promise<void> {
  if (canBypassForLocalhost()) {
    return;
  }

  let response: Response;

  try {
    response = await fetch(VERIFY_RECAPTCHA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, action }),
    });
  } catch (error) {
    if (RECAPTCHA_ALLOW_NETWORK_BYPASS) {
      console.warn("[reCAPTCHA] Verification endpoint unreachable; bypassing in development mode.", {
        action,
        endpoint: VERIFY_RECAPTCHA_URL,
        error,
      });
      return;
    }

    throw new Error(
      "Unable to reach security verification service. Please try again. If this continues, verify your Cloud Functions URL and CORS allowed origins."
    );
  }

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorData.error || "Security verification failed. Please try again.");
  }
}
