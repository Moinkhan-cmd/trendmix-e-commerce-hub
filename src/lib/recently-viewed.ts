export type RecentlyViewedItem = {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image?: string;
  viewedAt: number;
};

const STORAGE_KEY = "trendmix.recentlyViewed.v1";
const DEFAULT_MAX_ITEMS = 12;

function safeParse(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isRecentlyViewedItem(value: unknown): value is RecentlyViewedItem {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<RecentlyViewedItem>;
  return (
    typeof v.id === "string" &&
    v.id.trim().length > 0 &&
    typeof v.name === "string" &&
    v.name.trim().length > 0 &&
    typeof v.price === "number" &&
    Number.isFinite(v.price) &&
    typeof v.viewedAt === "number" &&
    Number.isFinite(v.viewedAt)
  );
}

export function getRecentlyViewed(): RecentlyViewedItem[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = safeParse(raw);

    if (!Array.isArray(parsed)) return [];

    const cleaned = parsed.filter(isRecentlyViewedItem);

    // Sort newest first.
    cleaned.sort((a, b) => b.viewedAt - a.viewedAt);

    // De-dupe by id (keep newest).
    const seen = new Set<string>();
    const unique: RecentlyViewedItem[] = [];
    for (const item of cleaned) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      unique.push(item);
    }

    return unique;
  } catch {
    return [];
  }
}

export function addRecentlyViewed(
  item: Omit<RecentlyViewedItem, "viewedAt"> & { viewedAt?: number },
  maxItems: number = DEFAULT_MAX_ITEMS,
): RecentlyViewedItem[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const now = typeof item.viewedAt === "number" && Number.isFinite(item.viewedAt) ? item.viewedAt : Date.now();

    const nextItem: RecentlyViewedItem = {
      id: String(item.id).trim(),
      name: String(item.name).trim(),
      price: Number(item.price ?? 0),
      originalPrice: item.originalPrice != null ? Number(item.originalPrice) : undefined,
      image: item.image ? String(item.image) : undefined,
      viewedAt: now,
    };

    if (!nextItem.id || !nextItem.name || !Number.isFinite(nextItem.price)) return getRecentlyViewed();

    const existing = getRecentlyViewed().filter((x) => x.id !== nextItem.id);
    const next = [nextItem, ...existing].slice(0, Math.max(1, Math.floor(maxItems)));

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return getRecentlyViewed();
  }
}

export function clearRecentlyViewed(): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
