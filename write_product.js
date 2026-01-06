const fs = require("fs");

const productCard = `import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ShoppingCart, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useShop } from "@/store/shop";
import { useRef, useState } from "react";

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

  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("");
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (y - centerY) / 10;
    const rotateY = (centerX - x) / 10;
    setTransform(\`perspective(1000px) rotateX(\${rotateX}deg) rotateY(\${rotateY}deg) scale3d(1.02, 1.02, 1.02)\`);
    setGlare({ x: (x / rect.width) * 100, y: (y / rect.height) * 100, opacity: 0.15 });
  };

  const handleMouseLeave = () => {
    setTransform("perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)");
    setGlare({ x: 50, y: 50, opacity: 0 });
  };

  return (
    <div
      ref={cardRef}
      className="group relative overflow-hidden rounded-xl bg-card border border-border transition-all duration-300 preserve-3d"
      style={{
        transform,
        transition: "transform 0.15s ease-out, box-shadow 0.3s ease",
        boxShadow: transform ? "0 25px 50px -12px rgba(0, 0, 0, 0.25)" : "none",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-xl"
        style={{
          background: \`radial-gradient(circle at \${glare.x}% \${glare.y}%, rgba(255,255,255,\${glare.opacity}) 0%, transparent 60%)\`,
          transition: "opacity 0.3s ease",
        }}
      />

      <Link to={\`/product/\${id}\`}>
        <div className="aspect-square overflow-hidden bg-muted relative">
          {image ? (
            <img src={image} alt={name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" style={{ transform: "translateZ(20px)" }} />
          ) : (
            <div className="h-full w-full" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
      </Link>

      {badge && <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground shadow-lg" style={{ transform: "translateZ(30px)" }}>{badge}</Badge>}
      {discount > 0 && <Badge className="absolute top-3 right-3 bg-destructive text-destructive-foreground shadow-lg animate-pulse" style={{ transform: "translateZ(30px)" }}>-{discount}%</Badge>}

      <Button
        size="icon"
        variant="ghost"
        className="absolute top-12 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-background/80 backdrop-blur hover:bg-background hover:scale-110"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist({ id, name, price, image }); }}
        aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
        style={{ transform: "translateZ(40px)" }}
      >
        <Heart className={wished ? "h-4 w-4 fill-primary text-primary" : "h-4 w-4"} />
      </Button>

      <div className="p-4 space-y-3" style={{ transform: "translateZ(10px)" }}>
        <Link to={\`/product/\${id}\`}><h3 className="font-medium line-clamp-2 hover:text-primary transition-colors">{name}</h3></Link>
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => <Star key={i} className={\`h-4 w-4 transition-transform hover:scale-125 \${i < Math.floor(rating) ? "fill-primary text-primary" : "fill-muted text-muted"}\`} />)}
          <span className="text-sm text-muted-foreground ml-1">({reviews})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">₹{price}</span>
          {originalPrice && <span className="text-sm text-muted-foreground line-through">₹{originalPrice}</span>}
        </div>
        <Button className="w-full group/btn shine-effect" size="sm" onClick={() => addToCart({ id, name, price, image }, 1)}>
          <ShoppingCart className="mr-2 h-4 w-4 transition-transform group-hover/btn:scale-110 group-hover/btn:rotate-12" />
          Add to Cart
        </Button>
      </div>
    </div>
  );
};

export default ProductCard;
`;

fs.writeFileSync("src/components/ProductCard.tsx", productCard);
console.log("Updated ProductCard.tsx");

