import productHenna from "@/assets/product-henna.webp";
import productHome from "@/assets/product-home.webp";

// Fallback images
import productCosmetics from "@/assets/product-cosmetics.webp";
import productJewelry from "@/assets/product-jewelry.jpg";
import productSocks from "@/assets/product-socks.jpg";
import productAccessories from "@/assets/product-accessories.jpg";

const FALLBACK_IMAGES = [productCosmetics, productJewelry, productSocks, productAccessories];

export const CATEGORY_IMAGES: Record<string, string> = {
    clothing: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=1000&auto=format&fit=crop",
    henna: productHenna,
    mehndi: productHenna,
    mehandi: productHenna,
    mehendi: productHenna,
    accessories: productAccessories,
    jewelry: productJewelry,
    jewelery: productJewelry,
    jewellery: productJewelry,
    cosmetic: productCosmetics,
    cosmetics: productCosmetics,
    beauty: productCosmetics,
    socks: productSocks,
    sock: productSocks,
    home: productHome,
    bags: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=1000&auto=format&fit=crop",
    shoes: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1000&auto=format&fit=crop"
};

export function getCategorySlug(name: string, rawSlug?: string): string {
    const nameLower = String(name ?? "").toLowerCase().trim();
    let slug = String(rawSlug ?? "").toLowerCase().trim();

    // Handle legacy "beauty" slug by treating it as "cosmetic"
    if (slug === "beauty") slug = "cosmetic";

    // Canonicalize common category slug variants
    if (slug === "mehndi" || slug === "mehandi" || slug === "mehendi") slug = "henna";
    if (slug === "cosmetics") slug = "cosmetic";
    if (slug === "jewelery" || slug === "jewellery") slug = "jewelry";
    if (slug === "accessory") slug = "accessories";

    // If slug is missing or inconsistent, prefer a name-derived canonical slug
    // for the key categories used in the UI.
    const canonicalFromName = (() => {
        if (nameLower.includes("sock")) return "socks";
        if (nameLower.includes("henna") || nameLower.includes("mehndi") || nameLower.includes("mehandi") || nameLower.includes("mehendi")) return "henna";
        if (nameLower.includes("cosmetic") || nameLower.includes("beauty") || nameLower.includes("makeup")) return "cosmetic";
        if (nameLower.includes("jewel")) return "jewelry";
        if (nameLower.includes("accessor")) return "accessories";
        return undefined;
    })();

    if (!slug) return canonicalFromName ?? "";

    // Override common mismatches like slug "clothing" but name "Socks".
    if (canonicalFromName) return canonicalFromName;

    return slug;
}

export function getCategoryImage(slug: string): string | undefined {
    return CATEGORY_IMAGES[slug];
}

export function getFallbackImage(index: number): string {
    return FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
}
