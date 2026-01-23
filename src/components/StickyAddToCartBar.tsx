import { useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StickyAddToCartBarProps {
  productName: string;
  price: number;
  imageUrl?: string;
  inStock: boolean;
  triggerRef: React.RefObject<HTMLElement>;
  onAddToCart: () => void;
  onBuyNow: () => void;
}

const StickyAddToCartBar = ({
  productName,
  price,
  imageUrl,
  inStock,
  triggerRef,
  onAddToCart,
  onBuyNow,
}: StickyAddToCartBarProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show sticky bar when the trigger element is NOT visible
        setIsVisible(!entry.isIntersecting);
      },
      {
        root: null,
        rootMargin: "-100px 0px 0px 0px",
        threshold: 0,
      }
    );

    observer.observe(trigger);

    return () => {
      observer.disconnect();
    };
  }, [triggerRef]);

  const priceText = `₹${price.toLocaleString("en-IN")}`;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t shadow-lg",
        "transform transition-transform duration-300 ease-out",
        isVisible ? "translate-y-0" : "translate-y-full"
      )}
    >
      <div className="container px-3 sm:px-4 py-2.5 sm:py-3">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Product thumbnail & info */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {imageUrl && (
              <img
                src={imageUrl}
                alt={productName}
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg object-cover border shrink-0"
              />
            )}
            <div className="min-w-0">
              <p className="text-sm sm:text-base font-medium truncate">{productName}</p>
              <p className="text-sm sm:text-lg font-bold text-primary">{priceText}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              className={cn(
                "h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm",
                "bg-[#ff9f00] text-black hover:bg-[#f39c00]",
                "dark:bg-[#ffb020] dark:hover:bg-[#f0a515]"
              )}
              onClick={onAddToCart}
              disabled={!inStock}
            >
              <ShoppingCart className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Add to </span>Cart
            </Button>

            <Button
              size="sm"
              className={cn(
                "h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm",
                "bg-[#fb641b] text-white hover:bg-[#f05a13]",
                "dark:bg-[#ff6a2a] dark:hover:bg-[#ff5a1f]"
              )}
              onClick={onBuyNow}
              disabled={!inStock}
            >
              ⚡ Buy Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StickyAddToCartBar;
