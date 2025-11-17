import { useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, ShoppingCart, Star, Truck, RotateCcw, ShieldCheck } from "lucide-react";
import productCosmetics from "@/assets/product-cosmetics.jpg";
import productJewelry from "@/assets/product-jewelry.jpg";
import productSocks from "@/assets/product-socks.jpg";

const ProductDetail = () => {
  const { id } = useParams();
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  const product = {
    id: 1,
    name: "Luxury Coral Lipstick - Matte Finish",
    price: 599,
    originalPrice: 899,
    image: productCosmetics,
    rating: 4.8,
    reviews: 234,
    badge: "Bestseller",
    description: "Experience luxury with our premium coral lipstick featuring a long-lasting matte finish. Enriched with vitamin E and natural oils for all-day comfort.",
    features: [
      "Long-lasting matte formula",
      "Enriched with Vitamin E",
      "Cruelty-free and vegan",
      "Available in 12 shades",
      "Smudge-proof finish",
    ],
    images: [productCosmetics, productCosmetics, productCosmetics],
  };

  const relatedProducts = [
    {
      id: 2,
      name: "Elegant Gold Necklace Set",
      price: 1299,
      originalPrice: 1799,
      image: productJewelry,
      rating: 4.9,
      reviews: 189,
      badge: "New",
    },
    {
      id: 3,
      name: "Premium Patterned Socks Collection",
      price: 399,
      originalPrice: 599,
      image: productSocks,
      rating: 4.7,
      reviews: 312,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 container py-8">
        <div className="grid gap-8 md:grid-cols-2 lg:gap-12 mb-16">
          <div className="space-y-4">
            <div className="aspect-square overflow-hidden rounded-xl bg-muted">
              <img
                src={product.images[selectedImage]}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="grid grid-cols-4 gap-4">
              {product.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={`aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                    selectedImage === index
                      ? "border-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <img
                    src={image}
                    alt={`${product.name} view ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              {product.badge && (
                <Badge className="mb-2">{product.badge}</Badge>
              )}
              <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
              
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.floor(product.rating)
                          ? "fill-primary text-primary"
                          : "fill-muted text-muted"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  {product.rating} ({product.reviews} reviews)
                </span>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl font-bold">₹{product.price}</span>
                {product.originalPrice && (
                  <>
                    <span className="text-xl text-muted-foreground line-through">
                      ₹{product.originalPrice}
                    </span>
                    <Badge variant="destructive">
                      {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
                    </Badge>
                  </>
                )}
              </div>

              <p className="text-muted-foreground mb-6">
                {product.description}
              </p>

              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-4">
                  <label className="font-medium">Quantity:</label>
                  <div className="flex items-center border border-border rounded-md">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      -
                    </Button>
                    <span className="px-4 py-2 min-w-[3rem] text-center">{quantity}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuantity(quantity + 1)}
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mb-8">
                <Button size="lg" className="flex-1 group">
                  <ShoppingCart className="mr-2 h-5 w-5 transition-transform group-hover:scale-110" />
                  Add to Cart
                </Button>
                <Button size="lg" variant="outline" className="px-4">
                  <Heart className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-3 p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3 text-sm">
                  <Truck className="h-5 w-5 text-primary" />
                  <span>Free delivery on orders above ₹500</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <RotateCcw className="h-5 w-5 text-primary" />
                  <span>Easy 7-day return policy</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <span>100% authentic products</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="description" className="mb-16">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({product.reviews})</TabsTrigger>
          </TabsList>
          <TabsContent value="description" className="mt-6 space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              {product.description}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Our luxury lipstick collection combines high-quality ingredients with stunning colors 
              to give you a flawless finish that lasts all day. Whether you're going for a bold look 
              or something more subtle, this lipstick delivers incredible pigmentation and comfort.
            </p>
          </TabsContent>
          <TabsContent value="features" className="mt-6">
            <ul className="space-y-2">
              {product.features.map((feature, index) => (
                <li key={index} className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="reviews" className="mt-6">
            <p className="text-muted-foreground">Customer reviews will appear here.</p>
          </TabsContent>
        </Tabs>

        <div>
          <h2 className="text-2xl font-bold mb-6">You May Also Like</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {relatedProducts.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProductDetail;
