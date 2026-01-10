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
import { SlidersHorizontal, ImageIcon } from "lucide-react";
import { db } from "@/lib/firebase";
import { getCategoryImage, getCategorySlug } from "@/lib/category-images";
import type { ProductDoc, CategoryDoc } from "@/lib/models";
import { getRecentlyViewed, type RecentlyViewedItem } from "@/lib/recently-viewed";

type WithId<T> = T & { id: string };

type SortOption = "featured" | "price-low" | "price-high" | "newest" | "rating";

const DEFAULT_PRICE_MAX = 2000;
const DEFAULT_PRICE_RANGE: [number, number] = [0, DEFAULT_PRICE_MAX];

function isPublished(value: unknown): boolean {
  // Be tolerant of legacy/incorrectly-typed data coming from Firestore.
  if (value === true) return true;
  if (value === 1) return true;
  if (typeof value === "string") return value.toLowerCase().trim() === "true";
  return false;
}

function getTimestampMs(value: unknown) {
  const anyValue = value as any;
  return typeof anyValue?.toMillis === "function" ? Number(anyValue.toMillis()) : 0;
}

const Products = () => {
  const [products, setProducts] = useState<Array<WithId<ProductDoc>>>([]);
  const [categories, setCategories] = useState<Array<WithId<CategoryDoc>>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);

  const [priceRange, setPriceRange] = useState<[number, number]>(DEFAULT_PRICE_RANGE);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [sort, setSort] = useState<SortOption>("featured");
  const [showFilters, setShowFilters] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const qProducts = collection(db, "products");
    const qCategories = collection(db, "categories");

    const unsubProducts = onSnapshot(
      qProducts,
      (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProductDoc) })));
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
    return getCategorySlug(activeCategoryParamRaw, activeCategoryParamRaw) || null;
  }, [activeCategoryParamRaw]);

  const queryParam = (searchParams.get("q") ?? "").toLowerCase().trim();

  const priceSliderMax = useMemo(() => {
    const maxInCatalog = products.reduce((acc, p) => {
      const price = Number(p.price ?? 0);
      return Number.isFinite(price) ? Math.max(acc, price) : acc;
    }, DEFAULT_PRICE_MAX);
    return Math.max(DEFAULT_PRICE_MAX, maxInCatalog);
  }, [products]);

  // If the catalog contains products above the default max, expand the default range
  // so newly added products are visible without needing user interaction.
  useEffect(() => {
    if (priceRange[1] === DEFAULT_PRICE_MAX && priceSliderMax > DEFAULT_PRICE_MAX) {
      setPriceRange([0, priceSliderMax]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceSliderMax]);

  const filteredProducts = useMemo(() => {
    const [minPrice, maxPrice] = priceRange;

    const categoryById = new Map(categories.map((c) => [c.id, c] as const));

    const getProductCategorySlug = (product: WithId<ProductDoc>): string => {
      const cat = product.categoryId ? categoryById.get(product.categoryId) : undefined;

      // Prefer explicit category slug fields; fall back to category doc name/slug.
      // Avoid using product.name here (it can accidentally override slugs via getCategorySlug heuristics).
      const rawSlug =
        String((product as any)?.categorySlug ?? "").trim() ||
        String((product as any)?.category ?? "").trim() ||
        String((product as any)?.categoryName ?? "").trim() ||
        String(cat?.slug ?? "").trim();

      const name = String(cat?.name ?? (product as any)?.categoryName ?? rawSlug ?? "").trim();

      return getCategorySlug(name, rawSlug);
    };

    const next = products.filter((product) => {
      const publishedOk = isPublished(product.published);
      const categoryOk = activeCategory ? getProductCategorySlug(product) === activeCategory : true;
      const queryOk = queryParam ? (product.name ?? "").toLowerCase().includes(queryParam) : true;
      const price = Number(product.price ?? 0);
      const priceOk = price >= minPrice && price <= maxPrice;
      const ratingOk = minRating != null ? true : true;

      return publishedOk && categoryOk && queryOk && priceOk && ratingOk;
    });

    if (sort === "featured" || sort === "rating") return next;

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
  }, [activeCategory, categories, minRating, priceRange, products, queryParam, sort]);

  const pageTitle = useMemo(() => {
    if (!activeCategory) return "All Products";
    const cat = categories.find((c) => getCategorySlug(c.name, c.slug) === activeCategory);
    if (cat?.name) return cat.name;
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

  const clearFilters = () => {
    setPriceRange([0, priceSliderMax]);
    setMinRating(null);
    setSort("featured");
    setCategoryParam(null);
  };

  const hasAnyPublishedProduct = useMemo(() => {
    return products.some((p) => isPublished(p.published));
  }, [products]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="container py-10 md:py-12">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{pageTitle}</h1>
                <p className="mt-2 text-sm text-muted-foreground">Showing {filteredProducts.length} product(s)</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden"
                >
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Filters
                </Button>
                <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                  <SelectTrigger className="w-[180px]">
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

            {recentlyViewed.length ? (
              <section aria-label="Recently viewed" className="mb-10">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">Recently viewed</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Quick access to products you opened</p>
                  </div>
                </div>

                <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                  {recentlyViewed.slice(0, 6).map((p) => (
                    <div key={p.id} className="min-w-[280px] max-w-[320px]">
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

            <div className="grid lg:grid-cols-[280px_1fr] gap-8">
              <aside className={`space-y-5 ${showFilters ? "block" : "hidden lg:block"}`}>
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="text-sm font-semibold">Categories</h3>
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
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          All
                        </label>
                      </div>
                      {categories.map((category) => {
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
                              className="flex items-center text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                            >
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
                              {category.name}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="text-sm font-semibold">Price Range</h3>
                  <Slider
                    value={priceRange}
                    onValueChange={(value) => setPriceRange(value as [number, number])}
                    max={priceSliderMax}
                    step={50}
                    className="mt-4 mb-4"
                  />
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>₹{priceRange[0]}</span>
                    <span>₹{priceRange[1]}</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="text-sm font-semibold">Rating</h3>
                  <div className="space-y-3">
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
                <Button variant="outline" className="w-full" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </aside>

              {loading ? (
                <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center">
                  <h2 className="text-lg font-semibold">Loading products…</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Fetching published products from the admin catalog.</p>
                </div>
              ) : loadError ? (
                <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center">
                  <h2 className="text-lg font-semibold">Couldn’t load products</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center">
                  <h2 className="text-lg font-semibold">
                    {products.length === 0 || !hasAnyPublishedProduct ? "Coming soon" : "No products found"}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {products.length === 0
                      ? "We’re setting things up. Check back soon for new arrivals."
                      : !hasAnyPublishedProduct
                        ? "We’re stocking the store right now. New products will be available soon."
                        : "Nothing matches your filters right now. Try clearing filters or selecting a different category."}
                  </p>
                </div>
              ) : (
                <div className="mx-auto w-full">
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        id={product.id}
                        name={product.name}
                        price={Number(product.price ?? 0)}
                        image={Array.isArray(product.imageUrls) ? product.imageUrls[0] : undefined}
                        rating={0}
                        reviews={0}
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
