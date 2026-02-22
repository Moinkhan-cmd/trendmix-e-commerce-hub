import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import RecentlyViewedMiniCard from "@/components/RecentlyViewedMiniCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { SlidersHorizontal, ImageIcon, Search, X, Tag, Users2, Star } from "lucide-react";
import { db } from "@/lib/firebase";
import { getCategoryImage, getCategorySlug } from "@/lib/category-images";
import type { ProductDoc, CategoryDoc } from "@/lib/models";
import { getRecentlyViewed, type RecentlyViewedItem } from "@/lib/recently-viewed";

type WithId<T> = T & { id: string };
type ProductListDoc = ProductDoc & {
  category?: string;
  categoryName?: string;
  rating?: number;
  reviews?: number;
  featured?: boolean;
};

type SortOption = "featured" | "price-low" | "price-high" | "newest" | "rating";

const DEFAULT_PRICE_MAX = 2000;
const DEFAULT_PRICE_RANGE: [number, number] = [0, DEFAULT_PRICE_MAX];
const priceCurrency = new Intl.NumberFormat("en-IN");

function isPublished(value: unknown): boolean {
  // Be tolerant of legacy/incorrectly-typed data coming from Firestore.
  if (value === true) return true;
  if (value === 1) return true;
  if (typeof value === "string") return value.toLowerCase().trim() === "true";
  return false;
}

function getTimestampMs(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return Number((value as { toMillis: () => number }).toMillis());
  }
  return 0;
}

const Products = () => {
  const hiddenCategorySlugs = useMemo(() => new Set(["electronics"]), []);

  const [products, setProducts] = useState<Array<WithId<ProductListDoc>>>([]);
  const [categories, setCategories] = useState<Array<WithId<CategoryDoc>>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);

  const [priceRange, setPriceRange] = useState<[number, number]>(DEFAULT_PRICE_RANGE);
  const [priceInputMin, setPriceInputMin] = useState<string>(String(DEFAULT_PRICE_RANGE[0]));
  const [priceInputMax, setPriceInputMax] = useState<string>(String(DEFAULT_PRICE_RANGE[1]));
  const [minRating, setMinRating] = useState<number | null>(null);
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female" | "unisex">("all");
  const [sort, setSort] = useState<SortOption>("featured");
  const [showFilters, setShowFilters] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    const qProducts = collection(db, "products");
    const qCategories = collection(db, "categories");

    const unsubProducts = onSnapshot(
      qProducts,
      (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProductListDoc) })));
        setLoading(false);
        setLoadError(null);
      },
      (err) => {
        setLoading(false);
        setLoadError(err?.message ?? "Failed to load products");
      },
    );

    const unsubCategories = onSnapshot(
      qCategories,
      (snap) => {
        setCategories(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CategoryDoc) })));
      },
      (err) => {
        console.error("Failed to load categories:", err);
      },
    );

    return () => {
      unsubProducts();
      unsubCategories();
    };
  }, []);

  useEffect(() => {
    setRecentlyViewed(getRecentlyViewed());
  }, []);

  const activeCategoryParamRaw = (searchParams.get("category") ?? "").toLowerCase().trim();

  const activeCategory = useMemo(() => {
    if (!activeCategoryParamRaw) return null;
    const slug = getCategorySlug(activeCategoryParamRaw, activeCategoryParamRaw) || null;
    if (!slug) return null;
    return hiddenCategorySlugs.has(slug) ? null : slug;
  }, [activeCategoryParamRaw, hiddenCategorySlugs]);

  const visibleCategories = useMemo(() => {
    return categories.filter((category) => !hiddenCategorySlugs.has(getCategorySlug(category.name, category.slug)));
  }, [categories, hiddenCategorySlugs]);

  const queryParam = (searchParams.get("q") ?? "").toLowerCase().trim();

  useEffect(() => {
    setSearchInput(searchParams.get("q") ?? "");
  }, [searchParams]);

  const priceSliderMax = useMemo(() => {
    const maxInCatalog = products.reduce((acc, p) => {
      const price = Number(p.price ?? 0);
      return Number.isFinite(price) ? Math.max(acc, price) : acc;
    }, DEFAULT_PRICE_MAX);
    return Math.max(DEFAULT_PRICE_MAX, maxInCatalog);
  }, [products]);

  const priceStep = useMemo(() => {
    if (priceSliderMax <= 2000) return 50;
    if (priceSliderMax <= 10000) return 100;
    return 500;
  }, [priceSliderMax]);

  const isDefaultPriceRange = priceRange[0] === 0 && priceRange[1] === priceSliderMax;

  // If the catalog contains products above the default max, expand the default range
  // so newly added products are visible without needing user interaction.
  useEffect(() => {
    if (priceRange[1] === DEFAULT_PRICE_MAX && priceSliderMax > DEFAULT_PRICE_MAX) {
      setPriceRange([0, priceSliderMax]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceSliderMax]);

  useEffect(() => {
    setPriceInputMin(String(priceRange[0]));
    setPriceInputMax(String(priceRange[1]));
  }, [priceRange]);

  const filteredProducts = useMemo(() => {
    const [minPrice, maxPrice] = priceRange;

    const categoryById = new Map(categories.map((c) => [c.id, c] as const));

    const getProductCategorySlug = (product: WithId<ProductListDoc>): string => {
      const cat = product.categoryId ? categoryById.get(product.categoryId) : undefined;

      // Prefer explicit category slug fields; fall back to category doc name/slug.
      // Avoid using product.name here (it can accidentally override slugs via getCategorySlug heuristics).
      const rawSlug =
        String(product.categorySlug ?? "").trim() ||
        String(product.category ?? "").trim() ||
        String(product.categoryName ?? "").trim() ||
        String(cat?.slug ?? "").trim();

      const name = String(cat?.name ?? product.categoryName ?? rawSlug ?? "").trim();

      return getCategorySlug(name, rawSlug);
    };

    const getProductRating = (product: WithId<ProductListDoc>) => {
      const raw = Number(product.rating ?? 0);
      return Number.isFinite(raw) ? raw : 0;
    };

    const next = products.filter((product) => {
      const publishedOk = isPublished(product.published);
      const categoryOk = activeCategory ? getProductCategorySlug(product) === activeCategory : true;
      const queryOk = (() => {
        if (!queryParam) return true;

        const haystack = [
          product.name,
          product.description,
          product.brand,
          product.sku,
          product.gender,
          ...(product.tags ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const terms = queryParam.split(/\s+/).filter(Boolean);
        return terms.every((t) => haystack.includes(t));
      })();
      const price = Number(product.price ?? 0);
      const priceOk = price >= minPrice && price <= maxPrice;
      const ratingOk = minRating != null ? getProductRating(product) >= minRating : true;
      const genderOk =
        genderFilter === "all"
          ? true
          : String(product.gender ?? "").toLowerCase() === genderFilter;

      return publishedOk && categoryOk && queryOk && priceOk && ratingOk && genderOk;
    });

    if (sort === "rating") {
      return [...next].sort((a, b) => getProductRating(b) - getProductRating(a));
    }

    if (sort === "featured") {
      return [...next].sort((a, b) => {
        const aFeatured = Boolean(a.featured);
        const bFeatured = Boolean(b.featured);
        if (aFeatured !== bFeatured) {
          return aFeatured ? -1 : 1;
        }
        const aMs = getTimestampMs(a.createdAt ?? a.updatedAt);
        const bMs = getTimestampMs(b.createdAt ?? b.updatedAt);
        return bMs - aMs;
      });
    }

    return [...next].sort((a, b) => {
      const aPrice = Number(a.price ?? 0);
      const bPrice = Number(b.price ?? 0);

      switch (sort) {
        case "price-low":
          return aPrice - bPrice;
        case "price-high":
          return bPrice - aPrice;
        case "newest": {
          const aMs = getTimestampMs(a.createdAt ?? a.updatedAt);
          const bMs = getTimestampMs(b.createdAt ?? b.updatedAt);
          return bMs - aMs;
        }
        default:
          return 0;
      }
    });
  }, [activeCategory, categories, genderFilter, minRating, priceRange, products, queryParam, sort]);

  const publishedProducts = useMemo(() => products.filter((p) => isPublished(p.published)), [products]);

  const categoryProductCounts = useMemo(() => {
    const categoryById = new Map(categories.map((c) => [c.id, c] as const));
    const counts = new Map<string, number>();

    for (const product of publishedProducts) {
      const cat = product.categoryId ? categoryById.get(product.categoryId) : undefined;
      const rawSlug =
        String(product.categorySlug ?? "").trim() ||
        String(product.category ?? "").trim() ||
        String(product.categoryName ?? "").trim() ||
        String(cat?.slug ?? "").trim();

      const name = String(cat?.name ?? product.categoryName ?? rawSlug ?? "").trim();
      const slug = getCategorySlug(name, rawSlug);

      if (!slug || hiddenCategorySlugs.has(slug)) continue;
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }

    return counts;
  }, [categories, hiddenCategorySlugs, publishedProducts]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (activeCategory) count += 1;
    if (genderFilter !== "all") count += 1;
    if (minRating != null) count += 1;
    if (!isDefaultPriceRange) count += 1;
    if (queryParam) count += 1;
    return count;
  }, [activeCategory, genderFilter, isDefaultPriceRange, minRating, queryParam]);

  const pageTitle = useMemo(() => {
    if (!activeCategory) return "All Products";
    const cat = categories.find((c) => getCategorySlug(c.name, c.slug) === activeCategory);
    if (cat) {
      // Handle legacy "Beauty" category - display as "Cosmetics"
      const nameLower = String(cat.name ?? "").toLowerCase().trim();
      const slugLower = String(cat.slug ?? "").toLowerCase().trim();
      if (nameLower === "beauty" || slugLower === "beauty" || activeCategory === "cosmetic") {
        return "Cosmetics";
      }
      return cat.name;
    }
    // If the category isn't present in the categories collection yet,
    // keep the UI consistent with the URL instead of falling back to "All Products".
    return activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1);
  }, [activeCategory, categories]);

  const setCategoryParam = (nextCategory: string | null) => {
    const next = new URLSearchParams(searchParams);

    if (nextCategory) {
      next.set("category", nextCategory);
    } else {
      next.delete("category");
    }

    setSearchParams(next);
  };

  // Note: Don't auto-clear unknown category slugs.
  // The navbar uses category slugs directly, and the Categories collection may be empty
  // (or not include that slug yet), which would otherwise bounce users back to All Products.

  const toggleMinRating = (rating: number) => {
    setMinRating((prev) => (prev === rating ? null : rating));
  };

  const clampPrice = (value: number) => {
    if (!Number.isFinite(value)) return 0;
    return Math.min(priceSliderMax, Math.max(0, Math.round(value)));
  };

  const updatePriceFromSlider = (value: number[]) => {
    if (!Array.isArray(value) || value.length < 2) return;
    const min = clampPrice(value[0]);
    const max = clampPrice(value[1]);
    setPriceRange([Math.min(min, max), Math.max(min, max)]);
  };

  const commitMinPriceInput = () => {
    const parsed = Number(priceInputMin);
    const nextMin = clampPrice(Number.isFinite(parsed) ? parsed : 0);
    setPriceRange(([, currentMax]) => {
      if (nextMin > currentMax) return [nextMin, nextMin];
      return [nextMin, currentMax];
    });
  };

  const commitMaxPriceInput = () => {
    const parsed = Number(priceInputMax);
    const nextMax = clampPrice(Number.isFinite(parsed) ? parsed : priceSliderMax);
    setPriceRange(([currentMin]) => {
      if (nextMax < currentMin) return [nextMax, nextMax];
      return [currentMin, nextMax];
    });
  };

  const clearFilters = () => {
    setPriceRange([0, priceSliderMax]);
    setMinRating(null);
    setGenderFilter("all");
    setSort("featured");
    setCategoryParam(null);
    const next = new URLSearchParams(searchParams);
    next.delete("q");
    setSearchParams(next);
  };

  const applySearch = () => {
    const next = new URLSearchParams(searchParams);
    const value = searchInput.trim();

    if (value) {
      next.set("q", value);
    } else {
      next.delete("q");
    }

    setSearchParams(next);
  };

  const clearSearch = () => {
    setSearchInput("");
    const next = new URLSearchParams(searchParams);
    next.delete("q");
    setSearchParams(next);
  };

  const hasAnyPublishedProduct = useMemo(() => {
    return products.some((p) => isPublished(p.published));
  }, [products]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1 relative">
        {/* Decorative background blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute top-1/3 -left-48 h-80 w-80 rounded-full bg-violet-500/4 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-primary/3 blur-3xl" />
        </div>

        <div className="container relative z-10 px-3 sm:px-4 md:px-6 pt-6 sm:pt-8 md:pt-10 pb-14 sm:pb-16">
          <div className="mx-auto max-w-7xl">

            {/* ── Page Header ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
              <div>
                <div className="mb-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary tracking-wide">
                    🛍️ Shop Collection
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
                  {pageTitle}
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  {loading
                    ? "Loading products…"
                    : `${filteredProducts.length} of ${publishedProducts.length} product${publishedProducts.length !== 1 ? "s" : ""}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden h-9 gap-2 border-border/60 text-sm font-medium"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}
                </Button>
                <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                  <SelectTrigger className="w-[155px] sm:w-[190px] h-9 text-xs sm:text-sm border-border/60">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured">⭐ Featured</SelectItem>
                    <SelectItem value="price-low">↑ Price: Low to High</SelectItem>
                    <SelectItem value="price-high">↓ Price: High to Low</SelectItem>
                    <SelectItem value="newest">🆕 Newest First</SelectItem>
                    <SelectItem value="rating">🏆 Top Rated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Search Bar ──────────────────────────────────────────── */}
            <div className="mb-5 sm:mb-6 rounded-2xl border border-border/50 bg-card shadow-sm p-3 sm:p-4">
              <div className="flex gap-2 sm:gap-3">
                <div className="relative flex-1 min-w-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applySearch();
                    }}
                    placeholder="Search by name, brand, tags…"
                    className="h-10 pl-9 pr-9 text-sm border-border/50 bg-muted/30 focus:bg-background transition-colors"
                    aria-label="Search products"
                  />
                  {searchInput ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={clearSearch}
                      className="absolute right-1.5 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
                <Button
                  type="button"
                  className="h-10 px-5 text-sm font-semibold rounded-xl shrink-0"
                  onClick={applySearch}
                >
                  Search
                </Button>
              </div>

              {/* Active filter chips */}
              {activeFiltersCount > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground mr-0.5">Active:</span>
                  {activeCategory ? (
                    <button
                      type="button"
                      onClick={() => setCategoryParam(null)}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/25 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors"
                    >
                      {pageTitle}
                      <X className="h-3 w-3" />
                    </button>
                  ) : null}
                  {genderFilter !== "all" ? (
                    <button
                      type="button"
                      onClick={() => setGenderFilter("all")}
                      className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 border border-violet-400/30 px-2.5 py-1 text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 transition-colors"
                    >
                      {genderFilter}
                      <X className="h-3 w-3" />
                    </button>
                  ) : null}
                  {minRating != null ? (
                    <button
                      type="button"
                      onClick={() => setMinRating(null)}
                      className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-400/30 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                    >
                      {minRating}★+
                      <X className="h-3 w-3" />
                    </button>
                  ) : null}
                  {!isDefaultPriceRange ? (
                    <button
                      type="button"
                      onClick={() => setPriceRange([0, priceSliderMax])}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-400/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      ₹{priceCurrency.format(priceRange[0])}–₹{priceCurrency.format(priceRange[1])}
                      <X className="h-3 w-3" />
                    </button>
                  ) : null}
                  {queryParam ? (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 border border-sky-400/30 px-2.5 py-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-colors"
                    >
                      &ldquo;{queryParam}&rdquo;
                      <X className="h-3 w-3" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-400/30 px-2.5 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors ml-1"
                  >
                    Clear all
                  </button>
                </div>
              ) : null}
            </div>

            {/* ── Recently Viewed ─────────────────────────────────────── */}
            {recentlyViewed.length > 0 ? (
              <section aria-label="Recently viewed" className="mb-6 sm:mb-8">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-foreground">Recently Viewed</h2>
                    <p className="text-xs text-muted-foreground">Pick up where you left off</p>
                  </div>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide snap-x snap-mandatory">
                  {recentlyViewed.slice(0, 6).map((p) => (
                    <div key={p.id} className="min-w-[180px] xs:min-w-[200px] sm:min-w-[220px] max-w-[220px] flex-shrink-0 snap-start">
                      <RecentlyViewedMiniCard
                        id={p.id}
                        name={p.name}
                        price={p.price}
                        originalPrice={p.originalPrice}
                        image={p.image}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* ── Main Layout ──────────────────────────────────────────── */}
            <div className="grid lg:grid-cols-[270px_1fr] xl:grid-cols-[290px_1fr] gap-5 lg:gap-7 xl:gap-8">

              {/* Mobile overlay backdrop */}
              {showFilters ? (
                <div
                  className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
                  onClick={() => setShowFilters(false)}
                  aria-hidden="true"
                />
              ) : null}

              {/* ── Filter Sidebar ─────────────────────────────────────── */}
              <aside
                className={
                  showFilters
                    ? "fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-background shadow-2xl animate-in slide-in-from-bottom duration-300 lg:sticky lg:top-24 lg:inset-auto lg:z-20 lg:max-h-[calc(100vh-7.5rem)] lg:rounded-2xl lg:bg-transparent lg:shadow-none lg:animate-none"
                    : "hidden lg:block lg:sticky lg:top-24 lg:self-start"
                }
              >
                <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">

                  {/* Sidebar header */}
                  <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/40 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-primary" />
                      <span className="font-bold text-sm text-foreground">Filters</span>
                      {activeFiltersCount > 0 ? (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1.5">
                          {activeFiltersCount}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {activeFiltersCount > 0 ? (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="text-[11px] font-semibold text-muted-foreground hover:text-rose-500 transition-colors"
                        >
                          Clear all
                        </button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 lg:hidden rounded-full"
                        onClick={() => setShowFilters(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 space-y-5">

                    {/* ── Categories ── */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <Tag className="h-3.5 w-3.5 text-primary" />
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Categories</h4>
                        </div>
                        <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          {visibleCategories.length}
                        </span>
                      </div>
                      <div className="space-y-1 max-h-[300px] overflow-y-auto scrollbar-hide">
                        {/* All Products */}
                        <button
                          type="button"
                          onClick={() => setCategoryParam(null)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                            !activeCategory
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-foreground hover:bg-muted/60"
                          }`}
                        >
                          <span>All Products</span>
                          <span
                            className={`text-xs font-bold tabular-nums ${
                              !activeCategory ? "text-primary-foreground/75" : "text-muted-foreground"
                            }`}
                          >
                            {publishedProducts.length}
                          </span>
                        </button>

                        {visibleCategories.map((category) => {
                          const slug = getCategorySlug(category.name, category.slug);
                          const isActive = activeCategory === slug;
                          const catImage = getCategoryImage(slug) || category.imageUrl;
                          const displayName = (() => {
                            const nameLower = String(category.name ?? "").toLowerCase().trim();
                            const slugLower = String(category.slug ?? "").toLowerCase().trim();
                            if (nameLower === "beauty" || slugLower === "beauty") return "Cosmetics";
                            return category.name;
                          })();
                          return (
                            <button
                              key={category.id}
                              type="button"
                              onClick={() => (isActive ? setCategoryParam(null) : setCategoryParam(slug))}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                                isActive
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : "text-foreground hover:bg-muted/60"
                              }`}
                            >
                              {catImage ? (
                                <img
                                  src={catImage}
                                  alt={displayName}
                                  className="h-7 w-7 rounded-lg object-cover shrink-0 border border-white/20"
                                />
                              ) : (
                                <div
                                  className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                                    isActive ? "bg-white/20" : "bg-muted"
                                  }`}
                                >
                                  <ImageIcon className="h-3.5 w-3.5" />
                                </div>
                              )}
                              <span className="flex-1 text-left truncate font-semibold">{displayName}</span>
                              <span
                                className={`text-xs font-bold tabular-nums shrink-0 ${
                                  isActive ? "text-primary-foreground/75" : "text-muted-foreground"
                                }`}
                              >
                                {categoryProductCounts.get(slug) ?? 0}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="h-px bg-border/40" />

                    {/* ── Gender ── */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <Users2 className="h-3.5 w-3.5 text-primary" />
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Gender</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            { key: "all", label: "All" },
                            { key: "male", label: "Male" },
                            { key: "female", label: "Female" },
                            { key: "unisex", label: "Unisex" },
                          ] as const
                        ).map((opt) => {
                          const selected = genderFilter === opt.key;
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => setGenderFilter(opt.key)}
                              className={`h-9 rounded-xl text-sm font-semibold border transition-all duration-150 ${
                                selected
                                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                  : "bg-background text-foreground border-border/60 hover:border-primary/40 hover:bg-muted/40"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="h-px bg-border/40" />

                    {/* ── Price Range ── */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-extrabold text-primary leading-none">₹</span>
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Price Range</h4>
                        </div>
                        {!isDefaultPriceRange ? (
                          <button
                            type="button"
                            onClick={() => setPriceRange([0, priceSliderMax])}
                            className="text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors"
                          >
                            Reset
                          </button>
                        ) : null}
                      </div>

                      {/* Price display */}
                      <div className="rounded-xl border border-border/50 bg-muted/20 py-2.5 mb-3 text-center">
                        <span className="text-sm font-extrabold text-foreground tabular-nums">
                          ₹{priceCurrency.format(priceRange[0])}
                          <span className="mx-2 text-muted-foreground font-medium text-xs">to</span>
                          ₹{priceCurrency.format(priceRange[1])}
                        </span>
                      </div>

                      <Slider
                        value={priceRange}
                        onValueChange={updatePriceFromSlider}
                        max={priceSliderMax}
                        step={priceStep}
                        className="mb-4"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="price-min" className="text-[10px] text-muted-foreground block mb-1 font-semibold">
                            Min (₹)
                          </label>
                          <Input
                            id="price-min"
                            type="number"
                            min={0}
                            max={priceRange[1]}
                            step={priceStep}
                            inputMode="numeric"
                            value={priceInputMin}
                            onChange={(e) => setPriceInputMin(e.target.value)}
                            onBlur={commitMinPriceInput}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                            }}
                            className="h-8 text-xs border-border/50"
                          />
                        </div>
                        <div>
                          <label htmlFor="price-max" className="text-[10px] text-muted-foreground block mb-1 font-semibold">
                            Max (₹)
                          </label>
                          <Input
                            id="price-max"
                            type="number"
                            min={priceRange[0]}
                            max={priceSliderMax}
                            step={priceStep}
                            inputMode="numeric"
                            value={priceInputMax}
                            onChange={(e) => setPriceInputMax(e.target.value)}
                            onBlur={commitMaxPriceInput}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                            }}
                            className="h-8 text-xs border-border/50"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-border/40" />

                    {/* ── Rating ── */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Min. Rating</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[4, 3, 2, 1].map((r) => {
                          const active = minRating === r;
                          return (
                            <button
                              key={r}
                              type="button"
                              onClick={() => toggleMinRating(r)}
                              className={`h-9 rounded-xl text-sm font-semibold border transition-all duration-150 flex items-center justify-center gap-1.5 ${
                                active
                                  ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                                  : "bg-background text-foreground border-border/60 hover:border-amber-400/60 hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
                              }`}
                            >
                              <Star
                                className={`h-3 w-3 ${
                                  active ? "fill-white text-white" : "fill-amber-400 text-amber-400"
                                }`}
                              />
                              {r}+
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Sidebar footer */}
                  <div className="px-4 pb-4 pt-3 border-t border-border/40 space-y-2">
                    {activeFiltersCount > 0 ? (
                      <Button
                        variant="outline"
                        className="w-full h-9 text-sm rounded-xl border-rose-300 text-rose-600 hover:bg-rose-50 hover:border-rose-400 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30 transition-all"
                        onClick={clearFilters}
                      >
                        Clear Filters ({activeFiltersCount})
                      </Button>
                    ) : null}
                    <Button
                      className="w-full lg:hidden h-10 text-sm font-bold rounded-xl"
                      onClick={() => setShowFilters(false)}
                    >
                      View {filteredProducts.length} Product{filteredProducts.length !== 1 ? "s" : ""}
                    </Button>
                  </div>
                </div>
              </aside>

              {/* ── Product Grid Area ────────────────────────────────── */}
              <div className="min-w-0">
                {loading ? (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5 md:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="rounded-2xl overflow-hidden border border-border/40 bg-card">
                        <div className="aspect-[4/5] bg-muted animate-pulse" />
                        <div className="p-3 sm:p-4 space-y-2.5">
                          <div className="h-3.5 w-4/5 bg-muted rounded-lg animate-pulse" />
                          <div className="h-3.5 w-3/5 bg-muted rounded-lg animate-pulse" />
                          <div className="h-5 w-2/5 bg-muted rounded-lg animate-pulse mt-1" />
                          <div className="h-9 w-full bg-muted rounded-xl animate-pulse mt-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : loadError ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 p-10 sm:p-16 text-center">
                    <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                      <X className="h-7 w-7 text-destructive" />
                    </div>
                    <h2 className="text-lg font-bold text-foreground">Couldn&apos;t load products</h2>
                    <p className="mt-2 text-sm text-muted-foreground max-w-xs">{loadError}</p>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-card/60 p-10 sm:p-16 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                      <Search className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <h2 className="text-lg font-bold text-foreground">
                      {products.length === 0 || !hasAnyPublishedProduct ? "Coming Soon" : "No Products Found"}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                      {products.length === 0
                        ? "We're setting things up. Check back soon for exciting new arrivals."
                        : !hasAnyPublishedProduct
                          ? "We're stocking the shelves right now. New products arriving very soon!"
                          : "No products match your current filters. Try adjusting or clearing them."}
                    </p>
                    {activeFiltersCount > 0 ? (
                      <Button
                        variant="outline"
                        className="mt-5 h-9 px-5 text-sm rounded-xl"
                        onClick={clearFilters}
                      >
                        Clear all filters
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {filteredProducts.map((product, index) => (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.4,
                          delay: Math.min(index * 0.06, 0.6),
                          ease: [0.25, 0.46, 0.45, 0.94],
                        }}
                      >
                        <ProductCard
                          id={product.id}
                          name={product.name}
                          price={Number(product.price ?? 0)}
                          originalPrice={typeof product.compareAtPrice === "number" ? product.compareAtPrice : undefined}
                          image={Array.isArray(product.imageUrls) ? product.imageUrls[0] : undefined}
                          badges={Array.isArray(product.badges) ? product.badges : undefined}
                          rating={Number(product.rating ?? 0)}
                          reviews={Number(product.reviews ?? 0)}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Products;
