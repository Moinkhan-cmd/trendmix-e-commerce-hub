import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import FeaturedProfileBanner from "@/components/FeaturedProfileBanner";
import CategoryCard from "@/components/CategoryCard";
import Footer from "@/components/Footer";
import { Sparkles, Gem, Shirt, Package } from "lucide-react";
import productCosmetics from "@/assets/product-cosmetics.jpg";
import productJewelry from "@/assets/product-jewelry.jpg";
import productSocks from "@/assets/product-socks.jpg";
import productAccessories from "@/assets/product-accessories.jpg";

const Index = () => {
  const categories = [
    {
      title: "Cosmetics",
      description: "Premium beauty essentials",
      image: productCosmetics,
      icon: Sparkles,
      href: "/products?category=cosmetics",
    },
    {
      title: "Jewelry",
      description: "Elegant accessories",
      image: productJewelry,
      icon: Gem,
      href: "/products?category=jewelry",
    },
    {
      title: "Fashion Socks",
      description: "Trendy & comfortable",
      image: productSocks,
      icon: Shirt,
      href: "/products?category=socks",
    },
    {
      title: "Accessories",
      description: "Complete your look",
      image: productAccessories,
      icon: Package,
      href: "/products?category=accessories",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <FeaturedProfileBanner />

        <Hero />

        <section id="categories" className="container py-16 md:py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Shop by Category
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Explore our curated collections of beauty products, jewelry, and fashion accessories
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <CategoryCard key={category.title} {...category} />
            ))}
          </div>
        </section>

        <section className="bg-muted/30 py-16 md:py-20">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                Featured Products
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Products will appear here once you add them from the admin panel.
              </p>
            </div>

            <div className="rounded-xl border border-dashed border-border bg-background p-10 text-center">
              <p className="text-sm text-muted-foreground">No products yet.</p>
              <p className="mt-2 text-sm">
                Go to <span className="font-medium">Admin → Products</span> to add your first product.
              </p>
            </div>
          </div>
        </section>

        <section className="container py-16 md:py-20">
          <div className="rounded-2xl bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 p-8 md:p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">Join Our Newsletter</h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              Get exclusive deals, new arrivals, and beauty tips delivered to your inbox
            </p>
            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 rounded-md border border-border bg-background"
              />
              <button className="px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors">
                Subscribe
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
