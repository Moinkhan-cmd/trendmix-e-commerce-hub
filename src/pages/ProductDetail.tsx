import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { ProductDoc } from "@/lib/models";
import { useShop } from "@/store/shop";
import { cn } from "@/lib/utils";
import ProductImageGallery from "@/components/ProductImageGallery";

type ProductWithId = ProductDoc & { id: string };

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, toggleWishlist, isWishlisted } = useShop();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<ProductWithId | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [qty, setQty] = useState<number>(1);
  const [pincode, setPincode] = useState<string>("");
  const [pincodeTouched, setPincodeTouched] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  // Ratings aren't stored in ProductDoc yet; keep UI ready while remaining truthful.
  const rating = 0;
  const reviewCount = 0;

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

      <main className="flex-1 container py-6 sm:py-10 pb-28 md:pb-10">
        {loading ? (
          <div className="rounded-xl border border-dashed border-border bg-background p-10 text-center">
            <h1 className="text-2xl font-semibold">Loading product…</h1>
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-dashed border-border bg-background p-10 text-center">
            <h1 className="text-2xl font-semibold">Couldn’t load product</h1>
            <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
            <div className="mt-6">
              <Button asChild variant="outline">
                <Link to="/products">Back to Products</Link>
              </Button>
            </div>
          </div>
        ) : !product ? (
          <div className="rounded-xl border border-dashed border-border bg-background p-10 text-center">
            <h1 className="text-2xl font-semibold">Product not found</h1>
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
          <div className="space-y-10">
            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
              {/* Left: Image Gallery */}
              <ProductImageGallery
                images={product.imageUrls}
                alt={product.name}
                onImageChange={setSelectedImage}
              />

              {/* Right: Product Info */}
              <section className="space-y-5" aria-label="Product information">
                <header className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug">
                        {product.name}
                      </h1>
                      {product.brand ? (
                        <p className="mt-1 text-sm text-muted-foreground">
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
                      className="shrink-0 transition-transform active:scale-[0.98]"
                      aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
                      title={wished ? "Wishlisted" : "Add to wishlist"}
                    >
                      <Heart className={wished ? "h-4 w-4 fill-primary text-primary" : "h-4 w-4"} />
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={
                            i < Math.floor(rating)
                              ? "h-4 w-4 fill-primary text-primary"
                              : "h-4 w-4 text-muted-foreground/30"
                          }
                        />
                      ))}
                      <span className="ml-1 text-sm text-muted-foreground">
                        {rating.toFixed(1)} ({reviewCount} reviews)
                      </span>
                    </div>

                    {inStock ? (
                      <Badge
                        className={cn(
                          "rounded-full",
                          lowStock ? "bg-amber-500 text-white hover:bg-amber-500" : "bg-emerald-600 text-white hover:bg-emerald-600",
                        )}
                      >
                        {lowStock ? `Only ${stock} left` : "In Stock"}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="rounded-full">
                        Out of Stock
                      </Badge>
                    )}

                    {product.sku ? (
                      <Badge variant="secondary" className="rounded-full">
                        SKU: {product.sku}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="flex items-end gap-3 pt-1">
                    <div className="text-3xl font-bold tracking-tight">{priceText}</div>
                    {compareAtText ? (
                      <div className="flex items-center gap-2 pb-1">
                        <span className="text-sm text-muted-foreground line-through">{compareAtText}</span>
                        <Badge variant="destructive" className="rounded-full">
                          {discountPct}% OFF
                        </Badge>
                      </div>
                    ) : null}
                  </div>
                </header>

                <Card>
                  <CardContent className="p-4 sm:p-5 space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold">Highlights</h2>
                      <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
                        {product.tags?.length ? (
                          product.tags.slice(0, 5).map((t) => <li key={t}>{t}</li>)
                        ) : (
                          <>
                            {product.brand ? <li>Trusted {product.brand} quality</li> : <li>Premium build and finish</li>}
                            {product.weightKg ? <li>Weight: {product.weightKg} kg</li> : <li>Fast delivery available</li>}
                            {product.dimensionsCm?.length || product.dimensionsCm?.width || product.dimensionsCm?.height ? (
                              <li>
                                Size: {product.dimensionsCm?.length ?? "–"}×{product.dimensionsCm?.width ?? "–"}×
                                {product.dimensionsCm?.height ?? "–"} cm
                              </li>
                            ) : (
                              <li>Easy returns and secure packaging</li>
                            )}
                          </>
                        )}
                      </ul>
                    </div>

                    <Separator />

                    <div className="grid gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">Quantity</span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => clampQty(qty - 1)}
                            disabled={!inStock || qty <= 1}
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>

                          <Input
                            type="number"
                            inputMode="numeric"
                            value={qty}
                            onChange={(e) => clampQty(Number(e.target.value))}
                            className="w-20 text-center"
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
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Button
                          size="lg"
                          className="w-full transition-transform active:scale-[0.99]"
                          onClick={addCurrentToCart}
                          disabled={!inStock}
                        >
                          <ShoppingCart className="mr-2 h-5 w-5" />
                          Add to Cart
                        </Button>

                        <Button
                          size="lg"
                          variant="secondary"
                          className="w-full transition-transform active:scale-[0.99]"
                          onClick={buyNow}
                          disabled={!inStock}
                        >
                          ⚡ Buy Now
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
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

                <Card>
                  <CardContent className="p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Truck className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-semibold">Delivery</p>
                          <p className="text-xs text-muted-foreground">Check estimate by pincode</p>
                        </div>
                      </div>
                      <div className="w-[200px]">
                        <Input
                          placeholder="Enter pincode"
                          value={pincode}
                          onChange={(e) => setPincode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                          onBlur={() => setPincodeTouched(true)}
                          inputMode="numeric"
                          aria-label="Enter pincode"
                        />
                      </div>
                    </div>

                    {pincodeStatus ? (
                      <p className={cn("text-sm", pincodeStatus.ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                        {pincodeStatus.message}
                      </p>
                    ) : null}

                    <Separator />

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="flex items-start gap-2">
                        <BadgeCheck className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <p className="text-sm font-medium">Cash on Delivery</p>
                          <p className="text-xs text-muted-foreground">Available on eligible pincodes</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Truck className="mt-0.5 h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium">Easy Returns</p>
                          <p className="text-xs text-muted-foreground">Simple pickup & refund flow</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium">Secure Payments</p>
                          <p className="text-xs text-muted-foreground">Protected checkout</p>
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
            <section aria-label="Product details" className="space-y-4">
              <Tabs defaultValue="description" className="w-full">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <TabsList className="w-full sm:w-auto">
                    <TabsTrigger value="description">Description</TabsTrigger>
                    <TabsTrigger value="specs">Specifications</TabsTrigger>
                    <TabsTrigger value="how">How to Use</TabsTrigger>
                    <TabsTrigger value="reviews">Reviews</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="description">
                  <Card>
                    <CardContent className="p-5">
                      {product.description ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <p className="whitespace-pre-line text-muted-foreground">{product.description}</p>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No description provided.</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="specs">
                  <Card>
                    <CardContent className="p-5">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-lg border bg-background p-4">
                          <p className="text-xs text-muted-foreground">Brand</p>
                          <p className="text-sm font-medium">{product.brand ?? "—"}</p>
                        </div>
                        <div className="rounded-lg border bg-background p-4">
                          <p className="text-xs text-muted-foreground">SKU</p>
                          <p className="text-sm font-medium">{product.sku ?? "—"}</p>
                        </div>
                        <div className="rounded-lg border bg-background p-4">
                          <p className="text-xs text-muted-foreground">Weight</p>
                          <p className="text-sm font-medium">{product.weightKg ? `${product.weightKg} kg` : "—"}</p>
                        </div>
                        <div className="rounded-lg border bg-background p-4">
                          <p className="text-xs text-muted-foreground">Dimensions</p>
                          <p className="text-sm font-medium">
                            {product.dimensionsCm?.length || product.dimensionsCm?.width || product.dimensionsCm?.height
                              ? `${product.dimensionsCm?.length ?? "–"}×${product.dimensionsCm?.width ?? "–"}×${product.dimensionsCm?.height ?? "–"} cm`
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="how">
                  <Card>
                    <CardContent className="p-5 space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Usage instructions vary by product and category.
                      </p>
                      <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                        <li>Read the label / packaging carefully before use.</li>
                        <li>Keep the invoice for easy returns and warranty claims.</li>
                        <li>Contact support from your account page for order help.</li>
                      </ul>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="reviews">
                  <Card>
                    <CardContent className="p-5 space-y-6">
                      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                        <div className="rounded-xl border bg-background p-4">
                          <p className="text-sm font-semibold">Ratings & Reviews</p>
                          <div className="mt-2 flex items-end gap-2">
                            <span className="text-4xl font-bold">{rating.toFixed(1)}</span>
                            <span className="pb-1 text-sm text-muted-foreground">/ 5</span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">Based on {reviewCount} reviews</p>

                          <div className="mt-4 space-y-2">
                            {[5, 4, 3, 2, 1].map((s) => {
                              const pct = 0;
                              return (
                                <div key={s} className="flex items-center gap-2 text-sm">
                                  <span className="w-8 text-muted-foreground">{s}★</span>
                                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="w-10 text-right text-muted-foreground">0%</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-4">
                          {reviewCount === 0 ? (
                            <div className="rounded-xl border border-dashed p-6 text-center">
                              <p className="text-sm font-semibold">No reviews yet</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Be the first to share your feedback after purchase.
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </section>

            {/* Mobile Sticky CTA Bar */}
            <div className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <div className="container py-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Price</p>
                    <p className="truncate text-base font-semibold">{priceText}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      size="lg"
                      className="h-11 px-4 transition-transform active:scale-[0.99]"
                      onClick={addCurrentToCart}
                      disabled={!inStock}
                    >
                      Add
                    </Button>
                    <Button
                      size="lg"
                      variant="secondary"
                      className="h-11 px-4 transition-transform active:scale-[0.99]"
                      onClick={buyNow}
                      disabled={!inStock}
                    >
                      Buy
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default ProductDetail;
