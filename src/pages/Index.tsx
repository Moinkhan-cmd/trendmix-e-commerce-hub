import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import CategoryCard from "@/components/CategoryCard";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { Sparkles, Gem, Shirt, Package } from "lucide-react";
import productCosmetics from "@/assets/product-cosmetics.jpg";
import productJewelry from "@/assets/product-jewelry.jpg";
import productSocks from "@/assets/product-socks.jpg";
import productAccessories from "@/assets/product-accessories.jpg";
import { db } from "@/lib/firebase";
import type { CategoryDoc, ProductDoc } from "@/lib/models";

type WithId<T> = T & { id: string };

function isPublished(value: unknown): boolean {
  if (value === true) return true;
  if (value === 1) return true;
  if (typeof value === "string") return value.toLowerCase().trim() === "true";
  return false;
}

const Index = () => {
  const [products, setProducts] = useState<Array<WithId<ProductDoc>>>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Array<WithId<CategoryDoc>>>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "products"),
      (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProductDoc) })));
        setProductsLoading(false);
        setProductsError(null);
      },
      (err) => {
        setProductsLoading(false);
        setProductsError(err?.message ?? "Failed to load products");
      },
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "categories"),
      (snap) => {
        setCategories(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CategoryDoc) })));
        setCategoriesLoading(false);
      },
      () => {
        setCategoriesLoading(false);
      },
    );

    return () => unsub();
  }, []);

  const homepageProducts = useMemo(() => {
    return products.filter((p) => isPublished(p.published)).slice(0, 8);
  }, [products]);

  const homepageCategories = useMemo(() => {
    const fallbackImages = [productCosmetics, productJewelry, productSocks, productAccessories];
    const icons = [Sparkles, Gem, Shirt, Package];

    return categories.map((c, idx) => {
      const image = c.imageUrl || fallbackImages[idx % fallbackImages.length];
      const icon = icons[idx % icons.length];
      return {
        title: c.name,
        description: "Browse products",
        image,
        icon,
        href: `/products?category=${encodeURIComponent((c.slug ?? "").toLowerCase())}`,
      };
    });
  }, [categories]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <Hero />

        <section id="categories" className="container py-16 md:py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4 relative inline-block">
              <span className="relative z-10">Shop by Category</span>
              <span className="absolute -bottom-2 left-0 right-0 h-3 bg-gradient-to-r from-primary/20 to-secondary/20 -skew-x-12 rounded" />
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Explore our curated collections of beauty products, jewelry, and fashion accessories
            </p>
          </div>

          <div className="perspective-1500 preserve-3d">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {homepageCategories.map((category, index) => (
                <div
                  key={category.title}
                  className="opacity-0 animate-in fade-in slide-in-from-bottom-4"
                  style={{ animationDelay: `${index * 100}ms`, animationFillMode: "forwards", animationDuration: "0.5s" }}
                >
                  <CategoryCard {...category} />
                </div>
              ))}
            </div>
          </div>

          {!categoriesLoading && homepageCategories.length === 0 ? (
            <div className="mt-10 rounded-xl border border-dashed border-border bg-background p-10 text-center shadow-3d">
              <p className="text-sm text-muted-foreground">No categories yet.</p>
              <p className="mt-2 text-sm">Go to <span className="font-medium">Admin ? Categories</span> to add categories.</p>
            </div>
          ) : null}
        </section>

        <section className="bg-muted/30 py-16 md:py-20">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Products</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Products will appear here once you add them from the admin panel.
              </p>
            </div>

            {productsLoading ? (
              <div className="rounded-xl border border-dashed border-border bg-background p-10 text-center shadow-3d">
                <p className="text-sm text-muted-foreground">Loading products…</p>
              </div>
            ) : productsError ? (
              <div className="rounded-xl border border-dashed border-border bg-background p-10 text-center shadow-3d">
                <p className="text-sm text-muted-foreground">Couldn’t load products.</p>
                <p className="mt-2 text-sm text-muted-foreground">{productsError}</p>
              </div>
            ) : homepageProducts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-background p-10 text-center shadow-3d">
                <p className="text-sm text-muted-foreground">No products yet.</p>
                <p className="mt-2 text-sm">
                  Go to <span className="font-medium">Admin ? Products</span> to add your first product.
                </p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {homepageProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={Number(product.price ?? 0)}
                    image={Array.isArray(product.imageUrls) ? product.imageUrls[0] : undefined}
                    rating={0}
                    reviews={0}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="container py-16 md:py-20">
          <div className="rounded-2xl bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 p-8 md:p-12 text-center relative overflow-hidden preserve-3d perspective-1000 tilt-3d">
            {/* 3D decorative elements */}
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/10 blur-2xl float-3d" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-secondary/10 blur-2xl float-3d-delayed" />

            <h2 className="text-3xl font-bold mb-4 relative z-10" style={{ transform: "translateZ(20px)" }}>Join Our Newsletter</h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto relative z-10" style={{ transform: "translateZ(15px)" }}>
              Get exclusive deals, new arrivals, and beauty tips delivered to your inbox
            </p>
            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto relative z-10" style={{ transform: "translateZ(30px)" }}>
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 rounded-md border border-border bg-background/80 backdrop-blur-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
              <button className="px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-all hover:scale-105 hover:shadow-lg shine-effect">
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
