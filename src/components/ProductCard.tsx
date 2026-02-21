import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ImageIcon, Minus, Plus, ShoppingCart, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useShop } from "@/store/shop";
import type { ProductBadge } from "@/lib/models";

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image?: string;
  rating?: number;
  reviews?: number;
  /** Backward compatible single badge label */
  badge?: string;
  /** New multi-badge support (e.g. ["bestseller", "trending"]) */
  badges?: ProductBadge[];
}

const ProductCard = ({
  id,
  name,
  price,
  originalPrice,
  image,
  rating = 0,
  reviews = 0,
  badge,
  badges,
}: ProductCardProps) => {
  const { addToCart, toggleWishlist, isWishlisted } = useShop();
  const quickQtyStorageKey = `trendmix:productQuickQty:${id}`;
  const clampQty = (value: number) => Math.max(1, Math.min(10, Math.round(value)));

  const getInitialQty = () => {
    if (typeof window === "undefined") return 1;
    const raw = window.localStorage.getItem(quickQtyStorageKey);
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clampQty(parsed) : 1;
  };

  const [quickQty, setQuickQty] = useState(1);
  const discount = originalPrice ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const wished = isWishlisted(id);

  const badgeLabel = (b: string): string => {
    const key = String(b ?? "").trim().toLowerCase();
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
  };

  const badgeClass = (b: string): string => {
    const key = String(b ?? "").trim().toLowerCase();
    switch (key) {
      case "bestseller":
        return "bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:from-purple-500 hover:to-purple-600 shadow-sm";
      case "trending":
        return "bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-600 shadow-sm";
      case "new":
        return "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-600 shadow-sm";
      case "hot":
        return "bg-gradient-to-r from-rose-600 to-rose-500 text-white hover:from-rose-500 hover:to-rose-600 shadow-sm";
      case "limited":
        return "bg-gradient-to-r from-amber-600 to-amber-500 text-white hover:from-amber-500 hover:to-amber-600 shadow-sm";
      case "exclusive":
        return "bg-gradient-to-r from-slate-800 to-slate-700 text-white hover:from-slate-700 hover:to-slate-800 dark:from-slate-200 dark:to-slate-100 dark:text-slate-900 shadow-sm";
      case "sale":
        return "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-sm";
      default:
        return "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-sm";
    }
  };

  const normalizedBadges = Array.from(
    new Set([
      ...(Array.isArray(badges) ? badges : []),
      ...(badge ? [badge] : []),
    ].map((b) => String(b).trim()).filter(Boolean)),
  ).slice(0, 2);

  const priceText = `₹${Number(price ?? 0).toLocaleString("en-IN")}`;
  const originalPriceText = originalPrice
    ? `₹${Number(originalPrice).toLocaleString("en-IN")}`
    : null;

  useEffect(() => {
    setQuickQty(getInitialQty());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickQtyStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(quickQtyStorageKey, String(clampQty(quickQty)));
  }, [quickQty, quickQtyStorageKey]);

  const decreaseQty = () => {
    setQuickQty((prev) => clampQty(prev - 1));
  };

  const increaseQty = () => {
    setQuickQty((prev) => clampQty(prev + 1));
  };

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/40 bg-card shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/30">

      {/* ── Image ── */}
      <div className="relative overflow-hidden bg-muted/50">
        <Link to={`/product/${id}`} aria-label={`View ${name}`} className="block">
          <div className="aspect-[4/5] overflow-hidden">
            {image ? (
              <img
                src={image}
                alt={name}
                className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.07]"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted via-muted/70 to-muted/50">
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/30" />
                  <span className="text-[10px] sm:text-xs text-muted-foreground/40">No image</span>
                </div>
              </div>
            )}
          </div>
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </Link>

        {/* Left badges */}
        {normalizedBadges.length > 0 ? (
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
            {normalizedBadges.map((b) => (
              <Badge
                key={b}
                className={"text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md tracking-wide border-0 " + badgeClass(b)}
              >
                {badgeLabel(b)}
              </Badge>
            ))}
          </div>
        ) : null}

        {/* Discount pill */}
        {discount > 0 ? (
          <div className="absolute top-2.5 right-2.5 z-10 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-rose-500 text-white shadow-md">
            <span className="text-[9px] sm:text-[10px] font-extrabold leading-tight text-center">-{discount}%</span>
          </div>
        ) : null}

        {/* Wishlist — bottom-right of image */}
        <Button
          size="icon"
          variant="ghost"
          className="absolute bottom-2.5 right-2.5 z-10 h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-background/95 backdrop-blur-sm border border-border/40 shadow-md hover:bg-background hover:scale-110 transition-all duration-200 opacity-0 group-hover:opacity-100"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist({ id, name, price, image });
          }}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart className={wished ? "h-4 w-4 fill-rose-500 text-rose-500" : "h-4 w-4 text-muted-foreground/60"} />
        </Button>
      </div>

      {/* ── Content ── */}
      <div className="flex flex-1 flex-col p-3 sm:p-4 gap-2.5">

        {/* Name */}
        <Link to={`/product/${id}`} className="group/name">
          <h3 className="text-[13px] sm:text-sm font-semibold leading-snug line-clamp-2 text-foreground group-hover/name:text-primary transition-colors duration-200 min-h-[2.5rem] sm:min-h-[2.75rem]">
            {name}
          </h3>
        </Link>

        {/* Rating */}
        {reviews > 0 ? (
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={
                    i < Math.floor(rating)
                      ? "h-3 w-3 sm:h-3.5 sm:w-3.5 fill-amber-400 text-amber-400"
                      : "h-3 w-3 sm:h-3.5 sm:w-3.5 fill-muted-foreground/10 text-muted-foreground/20"
                  }
                />
              ))}
            </div>
            <span className="text-[10px] sm:text-[11px] text-muted-foreground">
              {rating > 0 ? rating.toFixed(1) : ""} ({reviews})
            </span>
          </div>
        ) : (
          <div>
            <span className="inline-block text-[10px] sm:text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/50">
              New Arrival
            </span>
          </div>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-2 mt-auto">
          <span className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">{priceText}</span>
          {originalPriceText ? (
            <span className="text-[11px] sm:text-xs text-muted-foreground/50 line-through">{originalPriceText}</span>
          ) : null}
          {discount > 0 ? (
            <span className="ml-auto text-[10px] sm:text-[11px] font-bold text-rose-500 shrink-0">{discount}% off</span>
          ) : null}
        </div>

        {/* Quick qty — desktop hover only */}
        <div className="hidden sm:flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 px-3 py-1.5 opacity-0 translate-y-1 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto">
          <span className="text-xs font-medium text-muted-foreground">Qty</span>
          <div className="inline-flex items-center rounded-lg border border-border/60 bg-background overflow-hidden">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-none hover:bg-muted"
              onClick={decreaseQty}
              aria-label="Decrease quantity"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-7 text-center text-xs font-bold tabular-nums border-x border-border/50">{quickQty}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-none hover:bg-muted"
              onClick={increaseQty}
              aria-label="Increase quantity"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Add to Cart */}
        <Button
          className="w-full h-9 sm:h-10 text-xs sm:text-[13px] font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow-md hover:shadow-primary/25 transition-all duration-200 hover:-translate-y-0.5 gap-1.5"
          size="sm"
          onClick={() => addToCart({ id, name, price, image }, quickQty)}
        >
          <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          Add to Cart
        </Button>
      </div>
    </div>
  );
};

export default ProductCard;
