const SHIPROCKET_AUTH_URL = "https://apiv2.shiprocket.in/v1/external/auth/login";

let cachedToken: string | null = null;
let cachedTokenExpiryMs = 0;

function getEnv(name: string): string {
  const value = process.env[name]?.trim().replace(/^"|"$/g, "");
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseTokenExpiryMs(token: string): number {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return Date.now() + 30 * 60 * 1000;

    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      exp?: number;
    };

    if (typeof payload.exp === "number" && Number.isFinite(payload.exp)) {
      return payload.exp * 1000;
    }
  } catch {
    // fallback below
  }

  return Date.now() + 30 * 60 * 1000;
}

export async function getShiprocketBearerToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiryMs - 60 * 1000) {
    return cachedToken;
  }

  const email = getEnv("SHIPROCKET_EMAIL");
  const password = getEnv("SHIPROCKET_PASSWORD");

  const response = await fetch(SHIPROCKET_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Shiprocket auth failed (${response.status}): ${errorBody.slice(0, 300)}`);
  }

  const data = (await response.json()) as { token?: string };
  if (!data.token) {
    throw new Error("Shiprocket auth response did not include a token.");
  }

  cachedToken = data.token;
  cachedTokenExpiryMs = parseTokenExpiryMs(data.token);
  return data.token;
}
