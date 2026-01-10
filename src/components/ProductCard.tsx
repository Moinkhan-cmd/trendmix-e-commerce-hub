import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ImageIcon, ShoppingCart, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useShop } from "@/store/shop";

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image?: string;
  rating?: number;
  reviews?: number;
  badge?: string;
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
}: ProductCardProps) => {
  const { addToCart, toggleWishlist, isWishlisted } = useShop();
  const discount = originalPrice ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const wished = isWishlisted(id);

  const priceText = `₹${Number(price ?? 0).toLocaleString("en-IN")}`;
  const originalPriceText = originalPrice
    ? `₹${Number(originalPrice).toLocaleString("en-IN")}`
    : null;

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
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
              <div className="flex h-full w-full items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-background/60">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                  <span className="text-[11px]">Image unavailable</span>
                </div>
              </div>
            )}
          </div>
        </Link>

        {badge ? (
          <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">
            {badge}
          </Badge>
        ) : null}

        {discount > 0 ? (
          <Badge className="absolute top-3 right-3 bg-destructive text-destructive-foreground">
            -{discount}%
          </Badge>
        ) : null}

        <Button
          size="icon"
          variant="ghost"
          className="absolute right-3 top-12 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-background/70 backdrop-blur hover:bg-background"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist({ id, name, price, image });
          }}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart className={wished ? "h-4 w-4 fill-primary text-primary" : "h-4 w-4"} />
        </Button>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <Link to={`/product/${id}`} className="group/title">
          <h3 className="min-h-[2.75rem] text-sm font-medium leading-snug line-clamp-2 transition-colors group-hover/title:text-primary">
            {name}
          </h3>
        </Link>

        <div className="mt-2 flex items-center gap-1">
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
          <span className="ml-1 text-xs text-muted-foreground">({reviews})</span>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold">{priceText}</span>
            {originalPriceText ? (
              <span className="text-xs text-muted-foreground line-through">{originalPriceText}</span>
            ) : null}
          </div>
        </div>

        <Button
          className="mt-4 w-full"
          size="sm"
          onClick={() => addToCart({ id, name, price, image }, 1)}
        >
          <ShoppingCart className="mr-2 h-4 w-4" />
          Add to Cart
        </Button>
      </div>
    </div>
  );
};

export default ProductCard;
