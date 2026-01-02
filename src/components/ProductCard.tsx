import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ShoppingCart, Star } from "lucide-react";
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

  return (
    <div className="group relative overflow-hidden rounded-xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg">
      <Link to={`/product/${id}`}>
        <div className="aspect-square overflow-hidden bg-muted">
          {image ? (
            <img
              src={image}
              alt={name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full" />
          )}
        </div>
      </Link>

      {badge && <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">{badge}</Badge>}

      {discount > 0 && (
        <Badge className="absolute top-3 right-3 bg-destructive text-destructive-foreground">-{discount}%</Badge>
      )}

      <Button
        size="icon"
        variant="ghost"
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur hover:bg-background"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleWishlist({ id, name, price, image });
        }}
        aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
      >
        <Heart className={wished ? "h-4 w-4 fill-primary text-primary" : "h-4 w-4"} />
      </Button>

      <div className="p-4 space-y-3">
        <Link to={`/product/${id}`}>
          <h3 className="font-medium line-clamp-2 hover:text-primary transition-colors">{name}</h3>
        </Link>

        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${i < Math.floor(rating) ? "fill-primary text-primary" : "fill-muted text-muted"}`}
            />
          ))}
          <span className="text-sm text-muted-foreground ml-1">({reviews})</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">₹{price}</span>
          {originalPrice && <span className="text-sm text-muted-foreground line-through">₹{originalPrice}</span>}
        </div>

        <Button className="w-full group/btn" size="sm" onClick={() => addToCart({ id, name, price, image }, 1)}>
          <ShoppingCart className="mr-2 h-4 w-4 transition-transform group-hover/btn:scale-110" />
          Add to Cart
        </Button>
      </div>
    </div>
  );
};

export default ProductCard;
