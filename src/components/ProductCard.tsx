import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ImageIcon, ShoppingCart, Star } from "lucide-react";
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

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-xl xs:rounded-2xl border border-border/50 bg-card shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20"
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10" />
      
      <div className="relative">
        <Link to={`/product/${id}`} aria-label={`View ${name}`}>
          <div className="aspect-square overflow-hidden bg-muted">
            {image ? (
              <img
                src={image}
                alt={name}
                className="h-full w-full object-cover transition-all duration-700 group-hover:scale-110"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/80">
                <div className="flex flex-col items-center gap-1.5 xs:gap-2 text-muted-foreground">
                  <ImageIcon className="h-6 w-6 xs:h-8 xs:w-8 sm:h-10 sm:w-10 text-muted-foreground/40" />
                  <span className="text-[9px] xs:text-[10px] sm:text-[11px] text-muted-foreground/60">No image</span>
                </div>
              </div>
            )}
          </div>
        </Link>

        {normalizedBadges.length ? (
          <div className="absolute top-1.5 left-1.5 xs:top-2 xs:left-2 sm:top-3 sm:left-3 flex flex-col gap-1">
            {normalizedBadges.map((b) => (
              <Badge
                key={b}
                className={
                  "text-[9px] xs:text-[10px] sm:text-xs px-1.5 xs:px-2 py-0.5 " +
                  badgeClass(b)
                }
              >
                {badgeLabel(b)}
              </Badge>
            ))}
          </div>
        ) : null}

        {discount > 0 ? (
          <Badge className="absolute top-1.5 right-1.5 xs:top-2 xs:right-2 sm:top-3 sm:right-3 text-[9px] xs:text-[10px] sm:text-xs px-1.5 xs:px-2 py-0.5 bg-gradient-to-r from-destructive to-destructive/80 text-destructive-foreground shadow-sm">
            -{discount}%
          </Badge>
        ) : null}

        <Button
          size="icon"
          variant="ghost"
          className="absolute right-1.5 top-8 xs:right-2 xs:top-10 sm:right-3 sm:top-12 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-300 bg-background/80 backdrop-blur-sm hover:bg-background hover:scale-110 h-7 w-7 xs:h-8 xs:w-8 sm:h-10 sm:w-10 rounded-full shadow-md border border-border/50"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist({ id, name, price, image });
          }}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart className={wished ? "h-3.5 w-3.5 xs:h-4 xs:w-4 fill-primary text-primary animate-heartbeat" : "h-3.5 w-3.5 xs:h-4 xs:w-4 transition-colors"} />
        </Button>
      </div>

      <div className="relative flex flex-1 flex-col p-2.5 xs:p-3 sm:p-4">
        <Link to={`/product/${id}`} className="group/title">
          <h3 className="min-h-[2rem] xs:min-h-[2.25rem] sm:min-h-[2.75rem] text-[11px] xs:text-xs sm:text-sm font-medium leading-snug line-clamp-2 transition-colors duration-300 group-hover/title:text-primary">
            {name}
          </h3>
        </Link>

        <div className="mt-1.5 xs:mt-2 sm:mt-2.5 flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={
                i < Math.floor(rating)
                  ? "h-2.5 w-2.5 xs:h-3 xs:w-3 sm:h-4 sm:w-4 fill-amber-400 text-amber-400"
                  : "h-2.5 w-2.5 xs:h-3 xs:w-3 sm:h-4 sm:w-4 text-muted-foreground/20"
              }
            />
          ))}
          <span className="ml-1 text-[9px] xs:text-[10px] sm:text-xs text-muted-foreground">({reviews})</span>
        </div>

        <div className="mt-2 xs:mt-2.5 sm:mt-3 flex items-end justify-between gap-1 xs:gap-2 sm:gap-3">
          <div className="flex flex-wrap items-baseline gap-1 xs:gap-1.5 sm:gap-2">
            <span className="text-sm xs:text-base sm:text-lg font-bold text-foreground">{priceText}</span>
            {originalPriceText ? (
              <span className="text-[9px] xs:text-[10px] sm:text-xs text-muted-foreground/60 line-through">{originalPriceText}</span>
            ) : null}
          </div>
        </div>

        <Button
          className="mt-2.5 xs:mt-3 sm:mt-4 w-full h-8 xs:h-9 sm:h-10 text-[10px] xs:text-xs sm:text-sm font-medium rounded-lg bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-300"
          size="sm"
          onClick={() => addToCart({ id, name, price, image }, 1)}
        >
          <ShoppingCart className="mr-1 xs:mr-1.5 sm:mr-2 h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4" />
          Add to Cart
        </Button>
      </div>
    </div>
  );
};

export default ProductCard;
