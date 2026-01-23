import type { LucideIcon } from "lucide-react";
import { Gem, Hand, Package, Shirt, Sparkles } from "lucide-react";
import type { CategoryDoc } from "@/lib/models";
import { getCategoryImage, getCategorySlug, getFallbackImage } from "@/lib/category-images";

export type UICategory = {
  slug: string;
  title: string;
  description: string;
  image: string;
  icon: LucideIcon;
  href: string;
};

const HIDDEN_CATEGORY_SLUGS = new Set(["electronics"]);

type DefaultCategorySpec = {
  slug: string;
  title: string;
  icon: LucideIcon;
};

const DEFAULT_CATEGORIES: DefaultCategorySpec[] = [
  { slug: "cosmetic", title: "Cosmetics", icon: Sparkles },
  { slug: "jewelry", title: "Jewelry", icon: Gem },
  { slug: "socks", title: "Socks", icon: Shirt },
  { slug: "accessories", title: "Accessories", icon: Package },
  { slug: "henna", title: "Henna", icon: Hand },
];

function getDefaultTitleForSlug(slug: string): string | undefined {
  return DEFAULT_CATEGORIES.find((c) => c.slug === slug)?.title;
}

function getDefaultIconForSlug(slug: string): LucideIcon | undefined {
  return DEFAULT_CATEGORIES.find((c) => c.slug === slug)?.icon;
}

function titleFromSlug(slug: string): string {
  if (!slug) return "";
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pickBetterCategory(existing: UICategory, incoming: UICategory): UICategory {
  // Prefer entries with a non-fallback image, then keep existing.
  if (existing.image && !incoming.image) return existing;
  if (!existing.image && incoming.image) return incoming;

  // Prefer nicer title (defaults are usually the polished ones).
  const existingIsDefault = Boolean(getDefaultTitleForSlug(existing.slug));
  const incomingIsDefault = Boolean(getDefaultTitleForSlug(incoming.slug));
  if (incomingIsDefault && !existingIsDefault) return incoming;

  return existing;
}

export function buildUiCategoriesFromDocs(
  docs: Array<Pick<CategoryDoc, "name" | "slug" | "imageUrl">>,
): UICategory[] {
  const baseIcons: LucideIcon[] = [Sparkles, Gem, Shirt, Package, Hand];

  const deduped = new Map<string, UICategory>();

  docs.forEach((c, idx) => {
    const slug = getCategorySlug(c.name, c.slug);
    if (!slug) return;
    if (HIDDEN_CATEGORY_SLUGS.has(slug)) return;

    const defaultTitle = getDefaultTitleForSlug(slug);

    // Keep the display title tidy for legacy beauty category.
    const isLegacyBeauty = String(c.slug ?? "").toLowerCase().trim() === "beauty";
    const nameIsBeauty = String(c.name ?? "").toLowerCase().trim() === "beauty";

    const title = (defaultTitle || (isLegacyBeauty || nameIsBeauty ? "Cosmetics" : String(c.name ?? "").trim()) || titleFromSlug(slug)).trim();

    const mappedImage = getCategoryImage(slug);
    const image = (mappedImage || String(c.imageUrl ?? "").trim() || getFallbackImage(idx)).trim();

    const icon =
      getDefaultIconForSlug(slug) ||
      (slug === "henna" ? Hand : undefined) ||
      (slug === "cosmetic" ? Sparkles : undefined) ||
      (slug === "jewelry" ? Gem : undefined) ||
      (slug === "socks" ? Shirt : undefined) ||
      (slug === "accessories" ? Package : undefined) ||
      baseIcons[idx % baseIcons.length];

    const next: UICategory = {
      slug,
      title,
      description: "Browse products",
      image,
      icon,
      href: `/products?category=${encodeURIComponent(slug)}`,
    };

    const existing = deduped.get(slug);
    deduped.set(slug, existing ? pickBetterCategory(existing, next) : next);
  });

  // Ensure the key categories are always present (so navbar + homepage match).
  DEFAULT_CATEGORIES.forEach((spec) => {
    if (deduped.has(spec.slug)) return;

    const image = (getCategoryImage(spec.slug) || getFallbackImage(deduped.size)).trim();

    deduped.set(spec.slug, {
      slug: spec.slug,
      title: spec.title,
      description: "Browse products",
      image,
      icon: spec.icon,
      href: `/products?category=${encodeURIComponent(spec.slug)}`,
    });
  });

  // Stable order: defaults first, then everything else alphabetically.
  const defaultsInOrder = DEFAULT_CATEGORIES.map((d) => deduped.get(d.slug)).filter(
    (c): c is UICategory => Boolean(c),
  );

  const extras = Array.from(deduped.values())
    .filter((c) => !DEFAULT_CATEGORIES.some((d) => d.slug === c.slug))
    .sort((a, b) => a.title.localeCompare(b.title));

  return [...defaultsInOrder, ...extras];
}
