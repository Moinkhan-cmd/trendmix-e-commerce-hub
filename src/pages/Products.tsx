import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
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
import { SlidersHorizontal } from "lucide-react";
import { db } from "@/lib/firebase";
import type { ProductDoc } from "@/lib/models";

type WithId<T> = T & { id: string };

type Category = "cosmetics" | "jewelry" | "socks" | "accessories";

type SortOption = "featured" | "price-low" | "price-high" | "newest" | "rating";

const CATEGORY_LABEL: Record<Category, string> = {
  cosmetics: "Cosmetics",
  jewelry: "Jewelry",
  socks: "Socks",
  accessories: "Accessories",
};

const CATEGORY_OPTIONS: Array<{ label: string; value: Category | null }> = [
  { label: "All", value: null },
  { label: "Cosmetics", value: "cosmetics" },
  { label: "Jewelry", value: "jewelry" },
  { label: "Socks", value: "socks" },
  { label: "Accessories", value: "accessories" },
];

function isCategory(value: string): value is Category {
  return value === "cosmetics" || value === "jewelry" || value === "socks" || value === "accessories";
}

const DEFAULT_PRICE_RANGE: [number, number] = [0, 2000];

function getTimestampMs(value: unknown) {
  const anyValue = value as any;
  return typeof anyValue?.toMillis === "function" ? Number(anyValue.toMillis()) : 0;
}

const Products = () => {
  const [products, setProducts] = useState<Array<WithId<ProductDoc>>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [priceRange, setPriceRange] = useState<[number, number]>(DEFAULT_PRICE_RANGE);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [sort, setSort] = useState<SortOption>("featured");
  const [showFilters, setShowFilters] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const q = query(collection(db, "products"), where("published", "==", true));

    const unsub = onSnapshot(
      q,
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

    return () => unsub();
  }, []);

  const categoryParamRaw = (searchParams.get("category") ?? "").toLowerCase().trim();
  const activeCategory = isCategory(categoryParamRaw) ? categoryParamRaw : null;

  const queryParam = (searchParams.get("q") ?? "").toLowerCase().trim();

  const filteredProducts = useMemo(() => {
    const [minPrice, maxPrice] = priceRange;

    const next = products.filter((product) => {
      const categoryOk = activeCategory ? product.categorySlug === activeCategory : true;
      const queryOk = queryParam ? (product.name ?? "").toLowerCase().includes(queryParam) : true;
      const price = Number(product.price ?? 0);
      const priceOk = price >= minPrice && price <= maxPrice;
      const ratingOk = minRating != null ? true : true;

      return categoryOk && queryOk && priceOk && ratingOk;
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
  }, [activeCategory, minRating, priceRange, products, queryParam, sort]);

  const pageTitle = useMemo(() => {
    if (!activeCategory) return "All Products";
    return CATEGORY_LABEL[activeCategory] ?? "All Products";
  }, [activeCategory]);

  const setCategoryParam = (nextCategory: Category | null) => {
    const next = new URLSearchParams(searchParams);

    if (nextCategory) {
      next.set("category", nextCategory);
    } else {
      next.delete("category");
    }

    setSearchParams(next);
  };

  const toggleMinRating = (rating: number) => {
    setMinRating((prev) => (prev === rating ? null : rating));
  };

  const clearFilters = () => {
    setPriceRange(DEFAULT_PRICE_RANGE);
    setMinRating(null);
    setSort("featured");
    setCategoryParam(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">{pageTitle}</h1>
            <p className="text-muted-foreground">Showing {filteredProducts.length} product(s)</p>
          </div>
          <div className="flex items-center gap-4">
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

        <div className="grid lg:grid-cols-[240px_1fr] gap-8">
          <aside className={`space-y-6 ${showFilters ? "block" : "hidden lg:block"}`}>
            <div className="rounded-lg border border-border p-4">
              <h3 className="font-semibold mb-4">Categories</h3>
              <div className="space-y-3">
                {CATEGORY_OPTIONS.map((category) => {
                  const checked = category.value ? activeCategory === category.value : !activeCategory;
                  const id = `category-${category.value ?? "all"}`;

                  return (
                    <div key={id} className="flex items-center space-x-2">
                      <Checkbox
                        id={id}
                        checked={checked}
                        onCheckedChange={(v) => {
                          if (v) {
                            setCategoryParam(category.value);
                          } else if (category.value) {
                            setCategoryParam(null);
                          }
                        }}
                      />
                      <label
                        htmlFor={id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {category.label}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <h3 className="font-semibold mb-4">Price Range</h3>
              <Slider
                value={priceRange}
                onValueChange={(value) => setPriceRange(value as [number, number])}
                max={2000}
                step={50}
                className="mb-4"
              />
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>₹{priceRange[0]}</span>
                <span>₹{priceRange[1]}</span>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <h3 className="font-semibold mb-4">Rating</h3>
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
            <div className="rounded-xl border border-dashed border-border bg-background p-10 text-center">
              <h2 className="text-xl font-semibold">Loading products…</h2>
              <p className="mt-2 text-sm text-muted-foreground">Fetching published products from the admin catalog.</p>
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-dashed border-border bg-background p-10 text-center">
              <h2 className="text-xl font-semibold">Couldn’t load products</h2>
              <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background p-10 text-center">
              <h2 className="text-xl font-semibold">No products available</h2>
              <p className="mt-2 text-sm text-muted-foreground">Add products from the admin panel and mark them as published.</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Products;
