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
        return "bg-primary text-primary-foreground hover:bg-primary";
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
      className="group relative flex flex-col overflow-hidden rounded-lg xs:rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative">
        <Link to={`/product/${id}`} aria-label={`View ${name}`}>
          <div className="aspect-square overflow-hidden bg-muted">
            {image ? (
              <img
                src={image}
                alt={name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted">
                <div className="flex flex-col items-center gap-1.5 xs:gap-2 text-muted-foreground">
                  <ImageIcon className="h-6 w-6 xs:h-8 xs:w-8 sm:h-10 sm:w-10 text-muted-foreground/50" />
                  <span className="text-[9px] xs:text-[10px] sm:text-[11px]">No image</span>
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
                  "text-[9px] xs:text-[10px] sm:text-xs px-1.5 xs:px-2 " +
                  badgeClass(b)
                }
              >
                {badgeLabel(b)}
              </Badge>
            ))}
          </div>
        ) : null}

        {discount > 0 ? (
          <Badge className="absolute top-1.5 right-1.5 xs:top-2 xs:right-2 sm:top-3 sm:right-3 text-[9px] xs:text-[10px] sm:text-xs px-1.5 xs:px-2 bg-destructive text-destructive-foreground">
            -{discount}%
          </Badge>
        ) : null}

        <Button
          size="icon"
          variant="ghost"
          className="absolute right-1.5 top-8 xs:right-2 xs:top-10 sm:right-3 sm:top-12 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-200 bg-background/70 backdrop-blur hover:bg-background h-7 w-7 xs:h-8 xs:w-8 sm:h-10 sm:w-10"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist({ id, name, price, image });
          }}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart className={wished ? "h-3.5 w-3.5 xs:h-4 xs:w-4 fill-primary text-primary" : "h-3.5 w-3.5 xs:h-4 xs:w-4"} />
        </Button>
      </div>

      <div className="flex flex-1 flex-col p-2 xs:p-2.5 sm:p-4">
        <Link to={`/product/${id}`} className="group/title">
          <h3 className="min-h-[2rem] xs:min-h-[2.25rem] sm:min-h-[2.75rem] text-[11px] xs:text-xs sm:text-sm font-medium leading-snug line-clamp-2 transition-colors group-hover/title:text-primary">
            {name}
          </h3>
        </Link>

        <div className="mt-1 xs:mt-1.5 sm:mt-2 flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={
                i < Math.floor(rating)
                  ? "h-2.5 w-2.5 xs:h-3 xs:w-3 sm:h-4 sm:w-4 fill-primary text-primary"
                  : "h-2.5 w-2.5 xs:h-3 xs:w-3 sm:h-4 sm:w-4 text-muted-foreground/30"
              }
            />
          ))}
          <span className="ml-0.5 text-[9px] xs:text-[10px] sm:text-xs text-muted-foreground">({reviews})</span>
        </div>

        <div className="mt-1.5 xs:mt-2 sm:mt-3 flex items-end justify-between gap-1 xs:gap-2 sm:gap-3">
          <div className="flex flex-wrap items-baseline gap-0.5 xs:gap-1 sm:gap-2">
            <span className="text-xs xs:text-sm sm:text-base font-semibold">{priceText}</span>
            {originalPriceText ? (
              <span className="text-[9px] xs:text-[10px] sm:text-xs text-muted-foreground line-through">{originalPriceText}</span>
            ) : null}
          </div>
        </div>

        <Button
          className="mt-2 xs:mt-2.5 sm:mt-4 w-full h-7 xs:h-8 sm:h-9 text-[10px] xs:text-xs sm:text-sm"
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
