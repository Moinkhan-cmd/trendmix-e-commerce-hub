import { Link } from "react-router-dom";
import { ImageIcon, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useShop } from "@/store/shop";

type Props = {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image?: string;
  className?: string;
};

export default function RecentlyViewedMiniCard({
  id,
  name,
  price,
  originalPrice,
  image,
  className,
}: Props) {
  const { addToCart } = useShop();

  const priceText = `₹${Number(price ?? 0).toLocaleString("en-IN")}`;
  const originalPriceText =
    originalPrice != null ? `₹${Number(originalPrice).toLocaleString("en-IN")}` : null;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-xl border bg-card p-2.5 shadow-sm",
        "transition-colors hover:bg-accent/40",
        className,
      )}
    >
      <Link to={`/product/${id}`} className="flex items-center gap-3 min-w-0 flex-1">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
          {image ? (
            <img
              src={image}
              alt={name}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <p className="text-[13px] font-medium leading-snug line-clamp-2">{name}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[13px] font-semibold">{priceText}</span>
            {originalPriceText ? (
              <span className="text-xs text-muted-foreground line-through">{originalPriceText}</span>
            ) : null}
          </div>
        </div>
      </Link>

      <Button
        type="button"
        size="icon"
        variant="outline"
        className="shrink-0"
        onClick={() => addToCart({ id, name, price, image }, 1)}
        aria-label="Add to cart"
        title="Add to cart"
      >
        <ShoppingCart className="h-4 w-4" />
      </Button>
    </div>
  );
}
