import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductImageGallery from "@/components/ProductImageGallery";
import RecentlyViewedMiniCard from "@/components/RecentlyViewedMiniCard";
import StickyAddToCartBar from "@/components/StickyAddToCartBar";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";

import {
  BadgeCheck,
  Copy,
  Heart,
  MessageCircle,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
} from "lucide-react";

import { db } from "@/lib/firebase";
import type { ProductBadge, ProductDoc } from "@/lib/models";
import { useAuth } from "@/auth/AuthProvider";
import { useShop } from "@/store/shop";
import { cn } from "@/lib/utils";
import { addRecentlyViewed, getRecentlyViewed, type RecentlyViewedItem } from "@/lib/recently-viewed";

function productBadgeLabel(badge: ProductBadge | string): string {
  const key = String(badge ?? "").trim().toLowerCase();
  const map: Record<string, string> = {
    bestseller: "Bestseller",
    trending: "Trending",
    new: "New",
    hot: "Hot",
    limited: "Limited",
    exclusive: "Exclusive",
    sale: "Sale",
  };
  return map[key] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : "");
}

function productBadgeClass(badge: ProductBadge | string): string {
  const key = String(badge ?? "").trim().toLowerCase();
  switch (key) {
    case "bestseller":
      return "bg-purple-600 text-white hover:bg-purple-600";
    case "trending":
      return "bg-blue-600 text-white hover:bg-blue-600";
    case "new":
      return "bg-emerald-600 text-white hover:bg-emerald-600";
    case "hot":
      return "bg-rose-600 text-white hover:bg-rose-600";
    case "limited":
      return "bg-amber-600 text-white hover:bg-amber-600";
    case "exclusive":
      return "bg-slate-900 text-white hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-100";
    case "sale":
      return "bg-primary text-primary-foreground hover:bg-primary";
    default:
      return "bg-secondary text-secondary-foreground hover:bg-secondary";
  }
}

type ProductWithId = ProductDoc & { id: string };

type ProductReview = {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt?: Timestamp | Date | string | number | null;
};

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function formatReviewDate(value: ProductReview["createdAt"]): string {
  try {
    if (!value) return "";
    if (value instanceof Timestamp) return value.toDate().toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
    if (value instanceof Date) return value.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
    if (typeof value === "number") return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
    if (typeof value === "string") {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
    }
    return "";
  } catch {
    return "";
  }
}

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, toggleWishlist, isWishlisted } = useShop();
  const { user, profile, isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<ProductWithId | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [qty, setQty] = useState<number>(1);
  const [pincode, setPincode] = useState<string>("");
  const [pincodeTouched, setPincodeTouched] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ProductReview[]>([]);

  const [activeTab, setActiveTab] = useState<"description" | "specs" | "how" | "reviews">("description");
  const reviewsAnchorRef = useRef<HTMLDivElement | null>(null);
  const buyButtonsRef = useRef<HTMLDivElement | null>(null);

  const [newRating, setNewRating] = useState<number>(5);
  const [newComment, setNewComment] = useState<string>("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) {
        setLoading(false);
        setProduct(null);
        return;
      }

      setLoading(true);
      setLoadError(null);

      try {
        const snap = await getDoc(doc(db, "products", id));
        if (cancelled) return;

        if (!snap.exists()) {
          setProduct(null);
          setLoading(false);
          return;
        }

        const data = snap.data() as ProductDoc;
        if (!data.published) {
          setProduct(null);
          setLoading(false);
          return;
        }

        setProduct({ id: snap.id, ...data });
        setSelectedImage(data.imageUrls?.[0] ?? null);
        setQty(1);
        setPincode("");
        setPincodeTouched(false);
        setLoading(false);
      } catch (e: unknown) {
        if (cancelled) return;
        setLoading(false);
        const message =
          e instanceof Error
            ? e.message
            : typeof e === "string"
              ? e
              : "Failed to load product";
        setLoadError(message);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    // Load existing list (so we can render immediately on first paint)
    setRecentlyViewed(getRecentlyViewed());
  }, []);

  useEffect(() => {
    // Track this product view once product is loaded.
    if (!product?.id) return;
    const image = product.imageUrls?.[0] ?? undefined;
    const next = addRecentlyViewed({
      id: product.id,
      name: product.name,
      price: Number(product.price ?? 0),
      originalPrice: product.compareAtPrice != null ? Number(product.compareAtPrice) : undefined,
      image,
    });
    setRecentlyViewed(next);
  }, [product?.compareAtPrice, product?.id, product?.imageUrls, product?.name, product?.price]);

  const fetchReviews = useCallback(async (productId: string) => {
    setReviewsLoading(true);
    setReviewsError(null);

    try {
      // Primary strategy: order by createdAt desc
      const q1 = query(
        collection(db, "products", productId, "reviews"),
        orderBy("createdAt", "desc"),
        limit(25),
      );

      const snap = await getDocs(q1);
      const parsed = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const userNameRaw = data.userName ?? data.username ?? data.name;
        const commentRaw = data.comment ?? data.text ?? data.message;
        const ratingRaw = data.rating ?? data.stars;
        const createdAtRaw = data.createdAt ?? data.date;

        const userName = String(userNameRaw ?? "Customer").trim() || "Customer";
        const comment = String(commentRaw ?? "").trim();
        const rating = clampInt(Number(ratingRaw ?? 0), 1, 5);

        return {
          id: d.id,
          userName,
          rating,
          comment,
          createdAt: (createdAtRaw as ProductReview["createdAt"]) ?? null,
        } satisfies ProductReview;
      });

      setReviews(parsed);
      setReviewsLoading(false);
    } catch (e: unknown) {
      // Fallback: if indexing/orderBy fails, still try to fetch a few reviews.
      try {
        const q2 = query(collection(db, "products", productId, "reviews"), limit(25));
        const snap = await getDocs(q2);
        const parsed = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const userNameRaw = data.userName ?? data.username ?? data.name;
          const commentRaw = data.comment ?? data.text ?? data.message;
          const ratingRaw = data.rating ?? data.stars;
          const createdAtRaw = data.createdAt ?? data.date;
          const userName = String(userNameRaw ?? "Customer").trim() || "Customer";
          const comment = String(commentRaw ?? "").trim();
          const rating = clampInt(Number(ratingRaw ?? 0), 1, 5);
          return {
            id: d.id,
            userName,
            rating,
            comment,
            createdAt: (createdAtRaw as ProductReview["createdAt"]) ?? null,
          } satisfies ProductReview;
        });
        setReviews(parsed);
        setReviewsLoading(false);
      } catch (fallbackErr: unknown) {
        setReviewsLoading(false);
        const message =
          fallbackErr instanceof Error
            ? fallbackErr.message
            : typeof fallbackErr === "string"
              ? fallbackErr
              : e instanceof Error
                ? e.message
                : "Failed to load reviews";
        setReviewsError(message);
        setReviews([]);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!product?.id) {
      setReviews([]);
      setReviewsError(null);
      setReviewsLoading(false);
      return;
    }
    void (async () => {
      await fetchReviews(product.id);
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchReviews, product?.id]);

  const imageUrl = useMemo(() => {
    if (!product?.imageUrls?.length) return undefined;
    return product.imageUrls[0];
  }, [product]);

  const price = Number(product?.price ?? 0);
  const compareAtPrice = Number(product?.compareAtPrice ?? 0);
  const hasDiscount = Number.isFinite(compareAtPrice) && compareAtPrice > price;
  const discountPct = hasDiscount
    ? Math.max(1, Math.round(((compareAtPrice - price) / compareAtPrice) * 100))
    : 0;

  const stock = Number(product?.stock ?? 0);
  const inStock = stock > 0;
  const lowStock = inStock && stock <= 5;

  const priceText = useMemo(() => `₹${price.toLocaleString("en-IN")}`, [price]);
  const compareAtText = useMemo(
    () => (hasDiscount ? `₹${compareAtPrice.toLocaleString("en-IN")}` : null),
    [compareAtPrice, hasDiscount],
  );

  const reviewCount = reviews.length;
  const rating = useMemo(() => {
    if (!reviewCount) return 0;
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return sum / reviewCount;
  }, [reviewCount, reviews]);

  const ratingBreakdown = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      const s = clampInt(Number(r.rating ?? 0), 1, 5);
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [reviews]);

  const productUrl = (() => {
    try {
      return globalThis?.location?.href ?? "";
    } catch {
      return "";
    }
  })();

  const shareToWhatsapp = () => {
    if (!productUrl) return;
    const text = `Check this out: ${product?.name ?? "Product"} - ${productUrl}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(productUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn’t copy link");
    }
  };

  const clampQty = (next: number) => {
    const safe = Number.isFinite(next) ? Math.floor(next) : 1;
    const capped = inStock ? Math.min(Math.max(1, safe), stock) : 1;
    setQty(capped);
  };

  const addCurrentToCart = () => {
    if (!product) return;
    addToCart(
      {
        id: product.id,
        name: product.name,
        price: Number(product.price ?? 0),
        image: selectedImage ?? imageUrl,
      },
      qty,
    );
    toast.success("Added to cart");
  };

  const buyNow = () => {
    addCurrentToCart();
    navigate("/checkout");
  };

  const openReviews = () => {
    setActiveTab("reviews");
    window.requestAnimationFrame(() => {
      reviewsAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const submitReview = async () => {
    if (!product?.id) return;
    if (!isAuthenticated || !user) {
      toast.error("Please log in to write a review");
      navigate("/login");
      return;
    }

    const ratingValue = clampInt(newRating, 1, 5);
    const comment = newComment.trim();
    if (comment.length < 10) {
      toast.error("Please write at least 10 characters");
      return;
    }

    setSubmittingReview(true);
    try {
      // One review per user per product (enforced by query + UX).
      const existingQ = query(
        collection(db, "products", product.id, "reviews"),
        where("userId", "==", user.uid),
        limit(1),
      );
      const existingSnap = await getDocs(existingQ);
      if (!existingSnap.empty) {
        toast.error("You have already reviewed this product");
        setSubmittingReview(false);
        return;
      }

      const userName =
        String(profile?.displayName ?? user.displayName ?? user.email ?? "Customer").trim() || "Customer";

      await addDoc(collection(db, "products", product.id, "reviews"), {
        userId: user.uid,
        userName,
        rating: ratingValue,
        comment,
        createdAt: serverTimestamp(),
      });

      toast.success("Review submitted");
      setNewRating(5);
      setNewComment("");
      await fetchReviews(product.id);
      openReviews();
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : "Failed to submit review";
      toast.error(message);
    } finally {
      setSubmittingReview(false);
    }
  };

  const pincodeStatus = useMemo(() => {
    const normalized = (pincode ?? "").trim();
    if (!pincodeTouched && normalized.length === 0) return null;
    if (!/^\d{6}$/.test(normalized)) return { ok: false as const, message: "Enter a valid 6-digit pincode" };

    // Lightweight, deterministic estimate (no backend calls)
    const last = Number(normalized[5] ?? 0);
    const minDays = 2 + (last % 2);
    const maxDays = minDays + 2;
    return {
      ok: true as const,
      message: `Estimated delivery: ${minDays}-${maxDays} business days`,
    };
  }, [pincode, pincodeTouched]);

  const wished = isWishlisted(id ?? "");

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 pb-24 sm:pb-28 md:pb-10 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute top-1/3 -right-32 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-40 left-1/4 w-72 h-72 bg-primary/3 rounded-full blur-3xl" />
        </div>
        <div className="container relative px-0 sm:px-4 md:px-6 py-0 sm:py-6 md:py-10">
        {loading ? (
          <div className="px-3 sm:px-0 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <div className="aspect-square sm:aspect-[4/3] lg:aspect-square rounded-none sm:rounded-2xl border bg-muted animate-pulse" />
              <div className="flex gap-3 justify-center px-3 sm:px-0">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 w-16 rounded-xl border bg-muted animate-pulse" />
                ))}
              </div>
            </div>
            <div className="space-y-4 px-3 sm:px-0">
              <div className="h-8 w-3/4 rounded-lg bg-muted animate-pulse" />
              <div className="h-5 w-1/3 rounded-lg bg-muted animate-pulse" />
              <div className="h-10 w-1/2 rounded-lg bg-muted animate-pulse" />
              <div className="h-36 w-full rounded-2xl border bg-muted animate-pulse" />
            </div>
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-dashed border-border/50 bg-card/50 backdrop-blur-sm p-10 text-center">
            <h1 className="text-2xl font-semibold">Couldn’t load product</h1>
            <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
            <div className="mt-6">
              <Button asChild variant="outline">
                <Link to="/products">Back to Products</Link>
              </Button>
            </div>
          </div>
        ) : !product ? (
          <div className="rounded-2xl border border-dashed border-border/50 bg-card/50 backdrop-blur-sm p-10 text-center glass-card">
            <h1 className="text-2xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Product not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">This product isn’t available.</p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button asChild variant="outline">
                <Link to="/products">Back to Products</Link>
              </Button>
              <Button asChild>
                <Link to="/admin/login">Go to Admin</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-10">
            <nav aria-label="Breadcrumb" className="text-xs sm:text-sm text-muted-foreground px-3 sm:px-0 pt-3 sm:pt-0">
              <ol className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <li>
                  <Link className="hover:text-foreground transition-colors" to="/">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true" className="text-muted-foreground/50">/</li>
                <li>
                  <Link className="hover:text-foreground" to="/products">
                    Products
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li className="text-foreground font-medium line-clamp-1">{product.name}</li>
              </ol>
            </nav>

            <div className="grid gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-[1.1fr_0.9fr] xl:grid-cols-[1.15fr_0.85fr]">
              {/* Left: Image Gallery */}
              <ProductImageGallery
                images={product.imageUrls}
                alt={product.name}
                onImageChange={setSelectedImage}
                className="lg:sticky lg:top-4 lg:self-start"
              />

              {/* Right: Product Info */}
               <section className="space-y-3 sm:space-y-4 lg:space-y-5 px-3 sm:px-0" aria-label="Product information">
                <header className="space-y-1.5 sm:space-y-2">
                  <div className="flex items-start justify-between gap-2 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <h1 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight leading-snug bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                        {product.name}
                      </h1>
                      {product.brand ? (
                        <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground">
                          Brand: <span className="font-medium text-foreground">{product.brand}</span>
                        </p>
                      ) : null}
                    </div>

                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        toggleWishlist({
                          id: product.id,
                          name: product.name,
                          price: Number(product.price ?? 0),
                          image: selectedImage ?? imageUrl,
                        })
                      }
                      className="shrink-0 h-8 w-8 sm:h-10 sm:w-10 rounded-xl border-border/50 bg-background/80 backdrop-blur-sm transition-all hover:scale-105 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98]"
                      aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
                      title={wished ? "Wishlisted" : "Add to wishlist"}
                    >
                      <Heart className={wished ? "h-3.5 w-3.5 sm:h-4 sm:w-4 fill-primary text-primary" : "h-3.5 w-3.5 sm:h-4 sm:w-4"} />
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    {product?.badges?.length ? (
                      <div className="flex flex-wrap items-center gap-1">
                        {Array.from(new Set(product.badges)).slice(0, 3).map((b) => (
                          <Badge
                            key={b}
                            className={cn("rounded-full text-[10px] sm:text-xs px-1.5 sm:px-2", productBadgeClass(b))}
                          >
                            {productBadgeLabel(b)}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={openReviews}
                      className="flex items-center gap-0.5 sm:gap-1 rounded-md px-1 sm:px-1.5 py-0.5 transition-colors hover:bg-muted"
                      aria-label="Jump to reviews"
                    >
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={
                            i < Math.floor(rating)
                              ? "h-3 w-3 sm:h-4 sm:w-4 fill-primary text-primary"
                              : "h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground/30"
                          }
                        />
                      ))}
                      {reviewCount ? (
                        <span className="ml-0.5 sm:ml-1 text-[10px] sm:text-sm text-muted-foreground">
                          {rating.toFixed(1)} ({reviewCount})
                        </span>
                      ) : (
                        <span className="ml-0.5 sm:ml-1 text-[10px] sm:text-sm text-muted-foreground">No ratings</span>
                      )}
                    </button>

                    {inStock ? (
                      <Badge
                        className={cn(
                          "rounded-full text-[10px] sm:text-xs px-1.5 sm:px-2",
                          lowStock ? "bg-amber-500 text-white hover:bg-amber-500" : "bg-emerald-600 text-white hover:bg-emerald-600",
                        )}
                      >
                        {lowStock ? `Only ${stock} left` : "In Stock"}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="rounded-full text-[10px] sm:text-xs px-1.5 sm:px-2">
                        Out of Stock
                      </Badge>
                    )}

                  </div>

                  <div className="flex flex-wrap items-end gap-2 sm:gap-3 pt-0.5 sm:pt-1">
                    <div className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">{priceText}</div>
                    {compareAtText ? (
                      <div className="flex items-center gap-1.5 sm:gap-2 pb-0.5 sm:pb-1">
                        <span className="text-xs sm:text-sm text-muted-foreground line-through">{compareAtText}</span>
                        <Badge variant="destructive" className="rounded-full text-[10px] sm:text-xs">
                          {discountPct}% OFF
                        </Badge>
                      </div>
                    ) : null}
                  </div>
                </header>

                <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-lg shadow-primary/5">
                  <CardContent className="p-3 sm:p-4 md:p-5 space-y-3 sm:space-y-4">
                    <div>
                      <h2 className="text-xs sm:text-sm font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Highlights</h2>
                      <ul className="mt-1.5 sm:mt-2 space-y-1 sm:space-y-1.5 text-xs sm:text-sm text-muted-foreground list-disc pl-4 sm:pl-5">
                        {product.tags?.length ? (
                          product.tags.slice(0, 5).map((t) => <li key={t}>{t}</li>)
                        ) : (
                          <>
                            {product.brand ? <li>Trusted {product.brand} quality</li> : <li>Premium build and finish</li>}
                            <li>Fast delivery available</li>
                            <li>Easy returns and secure packaging</li>
                          </>
                        )}
                      </ul>
                    </div>

                    <Separator />

                    <div className="grid gap-2 sm:gap-3">
                      <div className="flex items-center justify-between gap-2 sm:gap-3">
                        <span className="text-xs sm:text-sm font-medium">Quantity</span>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => clampQty(qty - 1)}
                            disabled={!inStock || qty <= 1}
                            aria-label="Decrease quantity"
                            className="h-8 w-8 sm:h-10 sm:w-10"
                          >
                            <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>

                          <Input
                            type="number"
                            inputMode="numeric"
                            value={qty}
                            onChange={(e) => clampQty(Number(e.target.value))}
                            className="w-14 sm:w-20 h-8 sm:h-10 text-center text-sm"
                            min={1}
                            max={inStock ? stock : 1}
                            aria-label="Quantity"
                          />

                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => clampQty(qty + 1)}
                            disabled={!inStock || qty >= stock}
                            aria-label="Increase quantity"
                            className="h-8 w-8 sm:h-10 sm:w-10"
                          >
                            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                        </div>
                      </div>

                      <div ref={buyButtonsRef} className="grid grid-cols-2 sm:grid-cols-1 gap-2">
                        <Button
                          size="lg"
                          className={cn(
                            "w-full h-10 sm:h-11 text-sm sm:text-base transition-transform active:scale-[0.99]",
                            "bg-[#ff9f00] text-black hover:bg-[#f39c00]",
                            "dark:bg-[#ffb020] dark:hover:bg-[#f0a515]",
                          )}
                          onClick={addCurrentToCart}
                          disabled={!inStock}
                        >
                          <ShoppingCart className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="hidden xs:inline">Add to </span>Cart
                        </Button>

                        <Button
                          size="lg"
                          className={cn(
                            "w-full h-10 sm:h-11 text-sm sm:text-base transition-transform active:scale-[0.99]",
                            "bg-[#fb641b] text-white hover:bg-[#f05a13]",
                            "dark:bg-[#ff6a2a] dark:hover:bg-[#ff5a1f]",
                          )}
                          onClick={buyNow}
                          disabled={!inStock}
                        >
                          ⚡ Buy Now
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5 sm:pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={shareToWhatsapp}
                          className="gap-2"
                        >
                          <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          WhatsApp
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={copyLink} className="gap-2">
                          <Copy className="h-4 w-4" />
                          Copy Link
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-lg shadow-primary/5">
                  <CardContent className="p-3 sm:p-4 md:p-5 space-y-3 sm:space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                          <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm font-semibold">Delivery</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Check estimate by pincode</p>
                        </div>
                      </div>
                      <div className="w-full sm:w-[200px]">
                        <Input
                          placeholder="Enter pincode"
                          value={pincode}
                          onChange={(e) => setPincode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                          onBlur={() => setPincodeTouched(true)}
                          inputMode="numeric"
                          aria-label="Enter pincode"
                          className="h-8 sm:h-10 text-sm"
                        />
                      </div>
                    </div>

                    {pincodeStatus ? (
                      <p className={cn("text-xs sm:text-sm", pincodeStatus.ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                        {pincodeStatus.message}
                      </p>
                    ) : null}

                    <Separator />

                    <div className="grid gap-2 sm:gap-3 grid-cols-1 xs:grid-cols-3 sm:grid-cols-3">
                      <div className="flex items-start gap-1.5 sm:gap-2 rounded-xl border border-border/30 bg-background/60 backdrop-blur-sm p-2.5 sm:p-3 transition-all hover:shadow-md hover:border-primary/20">
                        <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-emerald-500/10 flex-shrink-0">
                          <BadgeCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-[11px] sm:text-sm font-medium">Cash on Delivery</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground hidden xs:block">Available on eligible pincodes</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-1.5 sm:gap-2 rounded-xl border border-border/30 bg-background/60 backdrop-blur-sm p-2.5 sm:p-3 transition-all hover:shadow-md hover:border-primary/20">
                        <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                          <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-[11px] sm:text-sm font-medium">Easy Returns</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground hidden xs:block">Simple pickup & refund</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-1.5 sm:gap-2 rounded-xl border border-border/30 bg-background/60 backdrop-blur-sm p-2.5 sm:p-3 transition-all hover:shadow-md hover:border-primary/20">
                        <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                          <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-[11px] sm:text-sm font-medium">Secure Payments</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground hidden xs:block">Protected checkout</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-center justify-between gap-3">
                  <Button asChild variant="outline">
                    <Link to="/products">Back to Products</Link>
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {inStock ? `Ships in 24-48 hours • Stock: ${stock}` : "Currently unavailable"}
                  </p>
                </div>
              </section>
            </div>

            {/* Tabs: Description / Specs / How to Use / Reviews */}
           <section aria-label="Product details" className="space-y-3 sm:space-y-4 px-3 sm:px-0">
              <div ref={reviewsAnchorRef} />
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
                <div className="flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
                  <TabsList className="w-full xs:w-auto h-8 xs:h-9 sm:h-10 p-0.5 xs:p-1 grid grid-cols-4 xs:flex bg-muted/50 backdrop-blur-sm border border-border/30 rounded-xl">
                    <TabsTrigger value="description" className="text-[9px] xs:text-[10px] sm:text-sm px-1.5 xs:px-2 sm:px-3 h-7 xs:h-8">Description</TabsTrigger>
                    <TabsTrigger value="specs" className="text-[9px] xs:text-[10px] sm:text-sm px-1.5 xs:px-2 sm:px-3 h-7 xs:h-8">Specs</TabsTrigger>
                    <TabsTrigger value="how" className="text-[9px] xs:text-[10px] sm:text-sm px-1.5 xs:px-2 sm:px-3 h-7 xs:h-8">How to Use</TabsTrigger>
                    <TabsTrigger value="reviews" className="text-[9px] xs:text-[10px] sm:text-sm px-1.5 xs:px-2 sm:px-3 h-7 xs:h-8">Reviews</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="description">
                  <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-lg shadow-primary/5">
                    <CardContent className="p-3 xs:p-4 sm:p-5">
                      {product.description ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <p className="whitespace-pre-line text-xs xs:text-sm text-muted-foreground">{product.description}</p>
                        </div>
                      ) : (
                        <p className="text-xs xs:text-sm text-muted-foreground">No description provided.</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="specs">
                  <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-lg shadow-primary/5">
                    <CardContent className="p-3 xs:p-4 sm:p-5">
                      <div className="grid gap-2.5 xs:gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2">
                        <div className="rounded-lg border bg-background p-3 xs:p-4">
                          <p className="text-[10px] xs:text-xs text-muted-foreground">Brand</p>
                          <p className="mt-0.5 xs:mt-1 text-xs xs:text-sm font-medium">{product.brand ?? "—"}</p>
                        </div>

                        <div className="rounded-lg border bg-background p-3 xs:p-4">
                          <p className="text-[10px] xs:text-xs text-muted-foreground">Category</p>
                          <p className="mt-0.5 xs:mt-1 text-xs xs:text-sm font-medium">
                            {(product.categorySlug ?? "—").replace(/-/g, " ")}
                          </p>
                        </div>

                        <div className="rounded-lg border bg-background p-3 xs:p-4 xs:col-span-2">
                          <p className="text-[10px] xs:text-xs text-muted-foreground">Tags</p>
                          {product.tags?.length ? (
                            <div className="mt-1.5 xs:mt-2 flex flex-wrap gap-1.5 xs:gap-2">
                              {product.tags.slice(0, 10).map((t) => (
                                <Badge key={t} variant="secondary" className="text-[10px] xs:text-xs">
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-0.5 xs:mt-1 text-xs xs:text-sm font-medium">—</p>
                          )}
                        </div>
                      </div>

                      {Array.isArray(product.specifications) && product.specifications.length > 0 && (
                        <div className="mt-6 space-y-6">
                          {product.specifications
                            .filter((s) => s?.title && Array.isArray(s.items) && s.items.length)
                            .map((section, si) => (
                              <div key={`${section.title}-${si}`} className="overflow-hidden rounded-lg border">
                                <div className="border-b bg-muted/30 px-4 py-3">
                                  <p className="text-base font-semibold">{section.title}</p>
                                </div>
                                <div className="divide-y">
                                  {section.items
                                    .filter((it) => it?.label && it?.value)
                                    .map((item, ii) => (
                                      <div
                                        key={`${item.label}-${ii}`}
                                        className="grid gap-2 px-4 py-3 sm:grid-cols-[220px_1fr]"
                                      >
                                        <p className="text-sm text-muted-foreground">{item.label}</p>
                                        <p className="text-sm font-medium">{item.value}</p>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="how">
                  <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-lg shadow-primary/5">
                    <CardContent className="p-3 xs:p-4 sm:p-5">
                      <div className="space-y-2 xs:space-y-3">
                        <p className="text-xs xs:text-sm text-muted-foreground">
                          Quick tips to get the best experience from this product.
                        </p>
                        <ul className="list-disc pl-4 xs:pl-5 text-xs xs:text-sm text-muted-foreground space-y-1.5 xs:space-y-2">
                          <li>Check the product specifications before ordering.</li>
                          <li>Store in a cool, dry place and avoid direct sunlight.</li>
                          <li>Keep the original packaging for easier returns and warranty support.</li>
                          <li>If you face any issue, contact support with your order details.</li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="reviews">
                  <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-lg shadow-primary/5">
                    <CardContent className="p-3 xs:p-4 sm:p-5">
                      <div className="grid gap-3 sm:gap-4 lg:grid-cols-[240px_1fr] xl:grid-cols-[260px_1fr]">
                        <div className="rounded-lg sm:rounded-xl border bg-background p-3 xs:p-4">
                          <p className="text-xs xs:text-sm font-semibold">Write a review</p>
                          {!isAuthenticated ? (
                            <div className="mt-2">
                              <p className="text-sm text-muted-foreground">Log in to rate and review.</p>
                              <Button className="mt-3" onClick={() => navigate("/login")}>
                                Log in
                              </Button>
                            </div>
                          ) : (
                            <div className="mt-3 space-y-3">
                              <div className="flex items-center gap-1">
                                {Array.from({ length: 5 }).map((_, i) => {
                                  const value = i + 1;
                                  const active = value <= newRating;
                                  return (
                                    <button
                                      key={value}
                                      type="button"
                                      onClick={() => setNewRating(value)}
                                      className="rounded-md p-1 transition-colors hover:bg-muted"
                                      aria-label={`${value} star`}
                                    >
                                      <Star
                                        className={
                                          active
                                            ? "h-5 w-5 fill-primary text-primary"
                                            : "h-5 w-5 text-muted-foreground/30"
                                        }
                                      />
                                    </button>
                                  );
                                })}
                              </div>

                              <Textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Share details about quality, fit, comfort, delivery…"
                                className="min-h-[110px]"
                              />
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">Min 10 characters</p>
                                <Button onClick={submitReview} disabled={submittingReview}>
                                  {submittingReview ? "Submitting…" : "Submit"}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-4">
                          <div className="rounded-xl border bg-background p-4">
                            <p className="text-sm font-semibold">Ratings summary</p>
                            <div className="mt-2 flex items-end gap-2">
                              <span className="text-4xl font-bold">{reviewCount ? rating.toFixed(1) : "—"}</span>
                              <span className="pb-1 text-sm text-muted-foreground">/ 5</span>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {reviewsLoading
                                ? "Loading reviews…"
                                : reviewsError
                                  ? "Couldn’t load reviews"
                                  : reviewCount
                                    ? `Based on ${reviewCount} review(s)`
                                    : "No reviews yet"}
                            </p>

                            <div className="mt-4 space-y-2">
                              {[5, 4, 3, 2, 1].map((s) => {
                                const count = ratingBreakdown[s] ?? 0;
                                const pct = reviewCount ? Math.round((count / reviewCount) * 100) : 0;
                                return (
                                  <div key={s} className="flex items-center gap-2 text-sm">
                                    <span className="w-8 text-muted-foreground">{s}★</span>
                                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="w-10 text-right text-muted-foreground">{pct}%</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {reviewsError ? (
                            <div className="rounded-xl border border-dashed p-6 text-center">
                              <p className="text-sm font-semibold">Reviews unavailable</p>
                              <p className="mt-1 text-sm text-muted-foreground">{reviewsError}</p>
                            </div>
                          ) : reviewsLoading ? (
                            <div className="space-y-3">
                              {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="rounded-xl border bg-background p-4">
                                  <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                                  <div className="mt-3 h-3 w-full rounded bg-muted animate-pulse" />
                                  <div className="mt-2 h-3 w-5/6 rounded bg-muted animate-pulse" />
                                </div>
                              ))}
                            </div>
                          ) : reviewCount === 0 ? (
                            <div className="rounded-xl border border-dashed p-6 text-center">
                              <p className="text-sm font-semibold">No reviews yet</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Be the first to share your feedback after purchase.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {reviews.map((r) => {
                                const dateText = formatReviewDate(r.createdAt);
                                return (
                                  <div key={r.id} className="rounded-xl border bg-background p-4">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-semibold">{r.userName}</p>
                                        {dateText ? <p className="text-xs text-muted-foreground">{dateText}</p> : null}
                                      </div>
                                      <div className="flex items-center gap-1" aria-label={`${r.rating} out of 5 stars`}>
                                        {Array.from({ length: 5 }).map((_, i) => (
                                          <Star
                                            key={i}
                                            className={
                                              i < r.rating
                                                ? "h-4 w-4 fill-primary text-primary"
                                                : "h-4 w-4 text-muted-foreground/30"
                                            }
                                          />
                                        ))}
                                      </div>
                                    </div>

                                    {r.comment ? (
                                      <p className="mt-3 text-sm text-muted-foreground whitespace-pre-line">{r.comment}</p>
                                    ) : null}
                                  </div>
                                );
                              })}
                              <p className="text-xs text-muted-foreground">Showing latest {reviewCount} review(s).</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </section>

            {recentlyViewed.filter((p) => p.id !== product.id).length ? (
              <section aria-label="Recently viewed" className="space-y-3 xs:space-y-4 px-3 sm:px-0">
                <div className="flex items-end justify-between gap-2 xs:gap-3">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 border border-secondary/20 px-3 py-1 text-[10px] xs:text-xs font-medium text-secondary mb-2">
                      👀 Recently Browsed
                    </span>
                    <h2 className="text-sm xs:text-base sm:text-lg font-semibold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Recently viewed</h2>
                    <p className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground">Pick up where you left off</p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="h-7 xs:h-8 sm:h-9 text-[10px] xs:text-xs sm:text-sm px-2 xs:px-3">
                    <Link to="/products">Browse all</Link>
                  </Button>
                </div>

                <div className="flex gap-2 xs:gap-2.5 sm:gap-3 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 snap-x snap-mandatory scrollbar-hide">
                  {recentlyViewed
                    .filter((p) => p.id !== product.id)
                    .slice(0, 6)
                    .map((p) => (
                      <div key={p.id} className="min-w-[180px] xs:min-w-[200px] sm:min-w-[240px] md:min-w-[260px] max-w-[280px] sm:max-w-[320px] snap-start">
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

            {/* Mobile Sticky CTA Bar */}
            <div className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-inset-bottom">
              <div className="container px-3 py-2 sm:py-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="min-w-0 flex-shrink-0">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Price</p>
                    <p className="truncate text-sm sm:text-base font-semibold">{priceText}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
                    <Button
                      size="lg"
                      className={cn(
                        "h-9 sm:h-11 px-3 sm:px-4 text-sm sm:text-base transition-transform active:scale-[0.99]",
                        "bg-[#ff9f00] text-black hover:bg-[#f39c00]",
                        "dark:bg-[#ffb020] dark:hover:bg-[#f0a515]",
                      )}
                      onClick={addCurrentToCart}
                      disabled={!inStock}
                    >
                      <ShoppingCart className="h-4 w-4 sm:mr-1.5" />
                      <span className="hidden sm:inline">Add</span>
                    </Button>
                    <Button
                      size="lg"
                      className={cn(
                        "h-9 sm:h-11 px-4 sm:px-5 text-sm sm:text-base transition-transform active:scale-[0.99]",
                        "bg-[#fb641b] text-white hover:bg-[#f05a13]",
                        "dark:bg-[#ff6a2a] dark:hover:bg-[#ff5a1f]",
                      )}
                      onClick={buyNow}
                      disabled={!inStock}
                    >
                      Buy Now
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Sticky Add to Cart Bar */}
        {product && (
          <StickyAddToCartBar
            productName={product.name}
            price={price}
            imageUrl={selectedImage ?? imageUrl}
            inStock={inStock}
            triggerRef={buyButtonsRef}
            onAddToCart={addCurrentToCart}
            onBuyNow={buyNow}
          />
        )}
      </main>

      <Footer />
    </div>
  );
};

export default ProductDetail;
