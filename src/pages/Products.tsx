import { useState } from "react";
import Navbar from "@/components/Navbar";
import ProductCard from "@/components/ProductCard";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { SlidersHorizontal } from "lucide-react";
import productCosmetics from "@/assets/product-cosmetics.jpg";
import productJewelry from "@/assets/product-jewelry.jpg";
import productSocks from "@/assets/product-socks.jpg";
import productAccessories from "@/assets/product-accessories.jpg";

const Products = () => {
  const [priceRange, setPriceRange] = useState([0, 2000]);
  const [showFilters, setShowFilters] = useState(true);

  const allProducts = [
    {
      id: 1,
      name: "Luxury Coral Lipstick - Matte Finish",
      price: 599,
      originalPrice: 899,
      image: productCosmetics,
      rating: 4.8,
      reviews: 234,
      badge: "Bestseller",
      category: "cosmetics",
    },
    {
      id: 2,
      name: "Elegant Gold Necklace Set",
      price: 1299,
      originalPrice: 1799,
      image: productJewelry,
      rating: 4.9,
      reviews: 189,
      badge: "New",
      category: "jewelry",
    },
    {
      id: 3,
      name: "Premium Patterned Socks Collection",
      price: 399,
      originalPrice: 599,
      image: productSocks,
      rating: 4.7,
      reviews: 312,
      category: "socks",
    },
    {
      id: 4,
      name: "Fashion Accessories Bundle",
      price: 799,
      originalPrice: 1199,
      image: productAccessories,
      rating: 4.6,
      reviews: 156,
      badge: "Deal",
      category: "accessories",
    },
    {
      id: 5,
      name: "Rose Gold Earring Collection",
      price: 899,
      originalPrice: 1299,
      image: productJewelry,
      rating: 4.8,
      reviews: 198,
      category: "jewelry",
    },
    {
      id: 6,
      name: "Designer Bangles Set",
      price: 1099,
      originalPrice: 1599,
      image: productAccessories,
      rating: 4.9,
      reviews: 145,
      badge: "Trending",
      category: "accessories",
    },
    {
      id: 7,
      name: "Premium Makeup Palette",
      price: 1499,
      originalPrice: 2199,
      image: productCosmetics,
      rating: 4.7,
      reviews: 267,
      category: "cosmetics",
    },
    {
      id: 8,
      name: "Casual Fashion Socks - 5 Pair Pack",
      price: 499,
      originalPrice: 799,
      image: productSocks,
      rating: 4.6,
      reviews: 423,
      category: "socks",
    },
    {
      id: 9,
      name: "Crystal Drop Earrings",
      price: 699,
      originalPrice: 999,
      image: productJewelry,
      rating: 4.7,
      reviews: 178,
      category: "jewelry",
    },
    {
      id: 10,
      name: "Hair Accessories Combo",
      price: 449,
      originalPrice: 699,
      image: productAccessories,
      rating: 4.5,
      reviews: 203,
      category: "accessories",
    },
    {
      id: 11,
      name: "Waterproof Eyeliner Set",
      price: 399,
      originalPrice: 599,
      image: productCosmetics,
      rating: 4.8,
      reviews: 312,
      category: "cosmetics",
    },
    {
      id: 12,
      name: "Athletic Compression Socks",
      price: 599,
      originalPrice: 899,
      image: productSocks,
      rating: 4.6,
      reviews: 256,
      category: "socks",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">All Products</h1>
            <p className="text-muted-foreground">
              Showing {allProducts.length} products
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden"
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Filters
            </Button>
            <Select defaultValue="featured">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="rating">Rating</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid lg:grid-cols-[240px_1fr] gap-8">
          <aside className={`space-y-6 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <div className="rounded-lg border border-border p-4">
              <h3 className="font-semibold mb-4">Categories</h3>
              <div className="space-y-3">
                {["All", "Cosmetics", "Jewelry", "Socks", "Accessories"].map((category) => (
                  <div key={category} className="flex items-center space-x-2">
                    <Checkbox id={category} />
                    <label
                      htmlFor={category}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {category}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <h3 className="font-semibold mb-4">Price Range</h3>
              <Slider
                value={priceRange}
                onValueChange={setPriceRange}
                max={2000}
                step={50}
                className="mb-4"
              />
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>₹{priceRange[0]}</span>
                <span>₹{priceRange[1]}</span>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <h3 className="font-semibold mb-4">Rating</h3>
              <div className="space-y-3">
                {[4, 3, 2, 1].map((rating) => (
                  <div key={rating} className="flex items-center space-x-2">
                    <Checkbox id={`rating-${rating}`} />
                    <label
                      htmlFor={`rating-${rating}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {rating}★ & above
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <Button variant="outline" className="w-full">
              Clear Filters
            </Button>
          </aside>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {allProducts.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Products;
