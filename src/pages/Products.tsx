import { useEffect, useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { SlidersHorizontal, ImageIcon, Search, X } from "lucide-react";
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
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="container px-3 sm:px-4 md:px-6 py-6 sm:py-8 md:py-12">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-2.5 xs:gap-3 sm:gap-4 sm:flex-row sm:items-end sm:justify-between mb-5 sm:mb-6 md:mb-8">
              <div className="min-w-0 flex-1">
                <h1 className="text-lg xs:text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight truncate">{pageTitle}</h1>
                <p className="mt-0.5 xs:mt-1 sm:mt-1.5 text-[11px] xs:text-xs sm:text-sm text-muted-foreground">
                  {loading
                    ? "Loading..."
                    : `Showing ${filteredProducts.length} of ${publishedProducts.length} product${publishedProducts.length !== 1 ? "s" : ""}`}
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden h-8 xs:h-9 text-[11px] xs:text-xs sm:text-sm px-2.5 xs:px-3"
                >
                  <SlidersHorizontal className="mr-1 xs:mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Filters{activeFiltersCount ? ` (${activeFiltersCount})` : ""}
                </Button>
                <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                  <SelectTrigger className="w-[120px] xs:w-[140px] sm:w-[180px] h-8 xs:h-9 text-[11px] xs:text-xs sm:text-sm">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured">Featured</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="rating">Rating</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mb-4 sm:mb-5 md:mb-6 rounded-xl border border-border bg-card p-2.5 sm:p-3 shadow-sm">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 min-w-0">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        applySearch();
                      }
                    }}
                    placeholder="Search products, brand, tags..."
                    className="h-9 pl-8 pr-9 text-xs sm:text-sm"
                    aria-label="Search products"
                  />
                  {searchInput ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={clearSearch}
                      className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <Button type="button" variant="outline" className="h-9 px-4 text-xs sm:text-sm" onClick={applySearch}>
                  Search
                </Button>
              </div>

              {activeFiltersCount > 0 ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {activeCategory ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 rounded-full px-2.5 text-[11px]"
                      onClick={() => setCategoryParam(null)}
                    >
                      Category: {pageTitle}
                      <X className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                  {genderFilter !== "all" ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 rounded-full px-2.5 text-[11px]"
                      onClick={() => setGenderFilter("all")}
                    >
                      Gender: {genderFilter}
                      <X className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                  {minRating != null ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 rounded-full px-2.5 text-[11px]"
                      onClick={() => setMinRating(null)}
                    >
                      Rating: {minRating}+★
                      <X className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                  {!isDefaultPriceRange ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 rounded-full px-2.5 text-[11px]"
                      onClick={() => setPriceRange([0, priceSliderMax])}
                    >
                      Price: ₹{priceCurrency.format(priceRange[0])} - ₹{priceCurrency.format(priceRange[1])}
                      <X className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                  {queryParam ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 rounded-full px-2.5 text-[11px]"
                      onClick={clearSearch}
                    >
                      Search: {queryParam}
                      <X className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={clearFilters}>
                    Clear all
                  </Button>
                </div>
              ) : null}
            </div>

            {recentlyViewed.length ? (
              <section aria-label="Recently viewed" className="mb-5 sm:mb-6 md:mb-8 lg:mb-10">
                <div className="flex items-end justify-between gap-2 sm:gap-3">
                  <div className="min-w-0">
                    <h2 className="text-sm xs:text-base sm:text-lg font-semibold tracking-tight">Recently viewed</h2>
                    <p className="mt-0.5 text-[10px] xs:text-xs sm:text-sm text-muted-foreground">Quick access to products you opened</p>
                  </div>
                </div>

                <div className="mt-2.5 sm:mt-3 md:mt-4 flex gap-2 xs:gap-2.5 sm:gap-3 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide snap-x snap-mandatory">
                  {recentlyViewed.slice(0, 6).map((p) => (
                    <div key={p.id} className="min-w-[180px] xs:min-w-[200px] sm:min-w-[240px] md:min-w-[260px] max-w-[260px] sm:max-w-[300px] flex-shrink-0 snap-start">
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

            <div className="grid lg:grid-cols-[260px_1fr] xl:grid-cols-[280px_1fr] gap-4 sm:gap-5 lg:gap-8">
              {/* Mobile filter overlay backdrop */}
              {showFilters && (
                <div 
                  className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
                  onClick={() => setShowFilters(false)}
                  aria-hidden="true"
                />
              )}
              <aside className={`
                ${showFilters 
                  ? "fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-background p-4 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-300 lg:relative lg:inset-auto lg:z-auto lg:max-h-none lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none lg:animate-none" 
                  : "hidden lg:block"
                }
                space-y-3 sm:space-y-4 lg:space-y-5
              `}>
                {/* Mobile filter header */}
                <div className="flex items-center justify-between lg:hidden mb-2">
                  <h2 className="text-base font-semibold">Filters</h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowFilters(false)} className="h-8 px-2">
                    ✕ Close
                  </Button>
                </div>
                <div className="rounded-xl sm:rounded-2xl border border-border bg-card p-3 sm:p-4 lg:p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Categories</h3>
                    <span className="text-[11px] text-muted-foreground">{visibleCategories.length}</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="category-all"
                          checked={!activeCategory}
                          onCheckedChange={(v) => {
                            if (v) setCategoryParam(null);
                          }}
                        />
                        <label
                          htmlFor="category-all"
                          className="flex w-full items-center justify-between gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          <span>All</span>
                          <span className="text-xs text-muted-foreground">{publishedProducts.length}</span>
                        </label>
                      </div>
                      {visibleCategories.map((category) => {
                        const slug = getCategorySlug(category.name, category.slug);
                        const checked = activeCategory === slug;
                        const id = `category-${slug}`;

                        return (
                          <div key={category.id} className="flex items-center space-x-3">
                            <Checkbox
                              id={id}
                              checked={checked}
                              onCheckedChange={(v) => {
                                if (v) {
                                  setCategoryParam(slug);
                                } else {
                                  setCategoryParam(null);
                                }
                              }}
                            />
                            <label
                              htmlFor={id}
                              className="flex items-center justify-between text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                            >
                              <span className="flex items-center min-w-0">
                                {(() => {
                                  const image = getCategoryImage(slug) || category.imageUrl;

                                  return image ? (
                                    <img
                                      src={image}
                                      alt={category.name}
                                      className="h-8 w-8 rounded object-cover mr-2 border border-border"
                                    />
                                  ) : (
                                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center mr-2 border border-border">
                                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  );
                                })()}
                                <span className="truncate">
                                  {(() => {
                                    // Handle legacy "Beauty" category - display as "Cosmetics"
                                    const nameLower = String(category.name ?? "").toLowerCase().trim();
                                    const slugLower = String(category.slug ?? "").toLowerCase().trim();
                                    if (nameLower === "beauty" || slugLower === "beauty") {
                                      return "Cosmetics";
                                    }
                                    return category.name;
                                  })()}
                                </span>
                              </span>
                              <span className="ml-2 text-xs text-muted-foreground">{categoryProductCounts.get(slug) ?? 0}</span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl sm:rounded-2xl border border-border bg-card p-3 sm:p-4 lg:p-5 shadow-sm">
                  <h3 className="text-xs sm:text-sm font-semibold">Gender</h3>
                  <div className="mt-3">
                    <Select value={genderFilter} onValueChange={(v) => setGenderFilter(v as typeof genderFilter)}>
                      <SelectTrigger className="h-9 text-xs sm:text-sm">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="unisex">Unisex</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-xl sm:rounded-2xl border border-border bg-card p-3 sm:p-4 lg:p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs sm:text-sm font-semibold">Price Range</h3>
                    {!isDefaultPriceRange ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] xs:text-xs"
                        onClick={() => setPriceRange([0, priceSliderMax])}
                      >
                        Reset
                      </Button>
                    ) : null}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label htmlFor="price-min" className="text-[10px] xs:text-xs text-muted-foreground">
                        Min
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
                          if (e.key === "Enter") {
                            (e.currentTarget as HTMLInputElement).blur();
                          }
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="price-max" className="text-[10px] xs:text-xs text-muted-foreground">
                        Max
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
                          if (e.key === "Enter") {
                            (e.currentTarget as HTMLInputElement).blur();
                          }
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <Slider
                    value={priceRange}
                    onValueChange={updatePriceFromSlider}
                    max={priceSliderMax}
                    step={priceStep}
                    className="mt-3 sm:mt-4 mb-3 sm:mb-4"
                  />

                  <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2 text-[11px] xs:text-xs sm:text-sm">
                    <span className="text-muted-foreground">₹{priceCurrency.format(priceRange[0])}</span>
                    <span className="font-medium text-foreground">to</span>
                    <span className="text-muted-foreground">₹{priceCurrency.format(priceRange[1])}</span>
                  </div>
                </div>

                <div className="rounded-xl sm:rounded-2xl border border-border bg-card p-3 sm:p-4 lg:p-5 shadow-sm">
                  <h3 className="text-xs sm:text-sm font-semibold">Rating</h3>
                  <div className="space-y-2 sm:space-y-3">
                    {[4, 3, 2, 1].map((rating) => {
                      const id = `rating-${rating}`;
                      const checked = minRating === rating;

                      return (
                        <div key={id} className="flex items-center space-x-2">
                          <Checkbox id={id} checked={checked} onCheckedChange={() => toggleMinRating(rating)} />
                          <label
                            htmlFor={id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {rating}★ & above
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <Button variant="outline" className="w-full h-9 sm:h-10 text-sm" onClick={clearFilters}>
                  Clear Filters{activeFiltersCount ? ` (${activeFiltersCount})` : ""}
                </Button>
                {/* Mobile apply filters button */}
                <Button 
                  className="w-full lg:hidden h-10 text-sm" 
                  onClick={() => setShowFilters(false)}
                >
                  Apply Filters ({filteredProducts.length} products)
                </Button>
              </aside>

              {loading ? (
                <div className="rounded-xl sm:rounded-2xl border border-dashed border-border bg-background p-5 sm:p-8 md:p-10 text-center">
                  <h2 className="text-base sm:text-lg font-semibold">Loading products…</h2>
                  <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground">Fetching published products from the admin catalog.</p>
                  {/* Loading skeleton grid */}
                  <div className="mt-4 sm:mt-6 grid grid-cols-2 gap-2.5 xs:gap-3 sm:gap-4 md:gap-5 md:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="aspect-[3/4] rounded-lg sm:rounded-xl bg-muted animate-pulse" />
                    ))}
                  </div>
                </div>
              ) : loadError ? (
                <div className="rounded-xl sm:rounded-2xl border border-dashed border-border bg-background p-5 sm:p-8 md:p-10 text-center">
                  <h2 className="text-base sm:text-lg font-semibold">Couldn't load products</h2>
                  <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground">{loadError}</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="rounded-xl sm:rounded-2xl border border-dashed border-border bg-background p-5 sm:p-8 md:p-10 text-center">
                  <h2 className="text-base sm:text-lg font-semibold">
                    {products.length === 0 || !hasAnyPublishedProduct ? "Coming soon" : "No products found"}
                  </h2>
                  <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground">
                    {products.length === 0
                      ? "We’re setting things up. Check back soon for new arrivals."
                      : !hasAnyPublishedProduct
                        ? "We’re stocking the store right now. New products will be available soon."
                        : "Nothing matches your filters right now. Try clearing filters or selecting a different category."}
                  </p>
                  {activeFiltersCount > 0 ? (
                    <Button variant="outline" className="mt-4 h-9 text-sm" onClick={clearFilters}>
                      Reset filters
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="mx-auto w-full">
                  <div className="grid grid-cols-2 gap-2.5 xs:gap-3 sm:gap-4 md:gap-5 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {filteredProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        id={product.id}
                        name={product.name}
                        price={Number(product.price ?? 0)}
                        originalPrice={typeof product.compareAtPrice === "number" ? product.compareAtPrice : undefined}
                        image={Array.isArray(product.imageUrls) ? product.imageUrls[0] : undefined}
                        badges={Array.isArray(product.badges) ? product.badges : undefined}
                        rating={Number(product.rating ?? 0)}
                        reviews={Number(product.reviews ?? 0)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Products;
