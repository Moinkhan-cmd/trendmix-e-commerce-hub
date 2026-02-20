import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import CategoryCard from "@/components/CategoryCard";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import WhyChooseUs from "@/components/WhyChooseUs";
import { db } from "@/lib/firebase";
import type { CategoryDoc, ProductDoc } from "@/lib/models";
import { buildUiCategoriesFromDocs } from "@/lib/ui-categories";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    return buildUiCategoriesFromDocs(categories);
  }, [categories]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <Hero />

        <section id="categories" className="relative border-y border-border/30 bg-gradient-to-b from-muted/20 via-muted/5 to-transparent overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
          </div>
          
          <div className="container relative py-16 md:py-24">
            <div className="mx-auto max-w-3xl text-center mb-12 md:mb-16">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-sm font-medium text-primary mb-4">
                ✨ Curated Collections
              </span>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text">
                Shop by Category
              </h2>
              <p className="mt-4 text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto">
                Explore curated collections across cosmetic, jewelry, and fashion accessories.
              </p>
            </div>

            <div className="mx-auto max-w-7xl">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {homepageCategories.map((category, idx) => (
                  <div key={category.title} className={`reveal-up stagger-${idx + 1}`}>
                    <CategoryCard {...category} />
                  </div>
                ))}
              </div>
            </div>

            {!categoriesLoading && homepageCategories.length === 0 ? (
              <div className="mt-12 rounded-2xl border border-dashed border-border/50 bg-card/50 backdrop-blur p-12 text-center glass-card">
                <p className="text-sm text-muted-foreground">No categories yet.</p>
                <p className="mt-2 text-sm">Go to <span className="font-medium text-primary">Admin → Categories</span> to add categories.</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="relative py-16 md:py-24">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center mb-12 md:mb-16">
              <span className="inline-flex items-center gap-2 rounded-full bg-secondary/10 border border-secondary/20 px-4 py-1.5 text-sm font-medium text-secondary mb-4">
                🔥 Hot & Trending
              </span>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Featured Products
              </h2>
              <p className="mt-4 text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto">
                A quick look at what's new and popular.
              </p>
            </div>

            {productsLoading ? (
              <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-border/50 bg-card/50 backdrop-blur p-12 text-center glass-card">
                <div className="flex items-center justify-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">Loading products…</p>
              </div>
            ) : productsError ? (
              <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 p-12 text-center">
                <p className="text-sm text-muted-foreground">Couldn't load products.</p>
                <p className="mt-2 text-sm text-muted-foreground">{productsError}</p>
              </div>
            ) : homepageProducts.length === 0 ? (
              <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-border/50 bg-card/50 backdrop-blur p-12 text-center glass-card">
                <p className="text-sm text-muted-foreground">No products yet.</p>
                <p className="mt-2 text-sm">
                  Go to <span className="font-medium text-primary">Admin → Products</span> to add your first product.
                </p>
              </div>
            ) : (
              <>
                <div className="mx-auto max-w-7xl">
                  <div className="grid grid-cols-2 gap-3 xs:gap-4 sm:gap-6 lg:grid-cols-4">
                    {homepageProducts.map((product, idx) => (
                      <div key={product.id} className={`reveal-up stagger-${(idx % 4) + 1}`}>
                        <ProductCard
                          id={product.id}
                          name={product.name}
                          price={Number(product.price ?? 0)}
                          originalPrice={typeof product.compareAtPrice === "number" ? product.compareAtPrice : undefined}
                          image={Array.isArray(product.imageUrls) ? product.imageUrls[0] : undefined}
                          badges={Array.isArray(product.badges) ? product.badges : undefined}
                          rating={0}
                          reviews={0}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-10 text-center reveal-up">
                  <Button asChild size="lg" variant="outline" className="group rounded-full px-8 border-primary/30 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-300 hover:shadow-lg hover:shadow-primary/20">
                    <Link to="/products">
                      View All Products
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>

        <WhyChooseUs />

        <section className="container py-16 md:py-24">
          <div className="relative rounded-3xl bg-gradient-to-br from-primary/15 via-secondary/10 to-primary/15 p-8 md:p-14 text-center overflow-hidden border border-primary/10 shadow-2xl">
            {/* Enhanced decorative elements */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 blur-3xl float-3d" />
            <div className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-gradient-to-br from-secondary/20 to-primary/20 blur-3xl float-3d-delayed" />
            <div className="absolute top-1/2 left-10 w-24 h-24 rounded-full bg-primary/10 blur-2xl float-3d-slow" />
            <div className="absolute top-10 right-1/4 w-16 h-16 rounded-full bg-secondary/15 blur-xl float-3d-delayed" />

            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 rounded-full bg-background/80 backdrop-blur border border-border/50 px-4 py-1.5 text-sm font-medium mb-6 shadow-lg">
                💌 Stay Updated
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-5 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                Join Our Newsletter
              </h2>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto text-lg">
                Get exclusive deals, new arrivals, and beauty tips delivered to your inbox
              </p>
              <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-5 py-3.5 rounded-xl border border-border bg-background/90 backdrop-blur-md focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-lg placeholder:text-muted-foreground/60"
                />
                <button className="px-8 py-3.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-xl font-semibold hover:from-primary/90 hover:to-primary transition-all hover:scale-105 hover:shadow-xl shadow-lg shadow-primary/25 shine-effect">
                  Subscribe
                </button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground/70">
                No spam, unsubscribe anytime. We respect your privacy.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
