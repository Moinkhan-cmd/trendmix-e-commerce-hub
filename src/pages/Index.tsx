import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import CategoryCard from "@/components/CategoryCard";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { Gem, Shirt, Package, Hand, Sparkles } from "lucide-react";
import { db } from "@/lib/firebase";
import { getCategoryImage, getCategorySlug, getFallbackImage } from "@/lib/category-images";
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
    const hiddenCategorySlugs = new Set(["electronics"]);
    const icons = [Sparkles, Gem, Shirt, Package];

    const processedCategories = categories.map((c, idx) => {
      const slug = getCategorySlug(c.name, c.slug);
      if (hiddenCategorySlugs.has(slug)) return null;
      let title = c.name;

      // Keep the display title tidy for legacy beauty category.
      if ((c.slug ?? "").toLowerCase() === "beauty") {
        title = "Cosmetic";
      }

      const mappedImage = getCategoryImage(slug);
      const image = mappedImage || c.imageUrl || getFallbackImage(idx);
      
      // Select icon based on slug
      let IconToUse = icons[idx % icons.length];
      if (slug === 'henna' || slug === 'mehndi' || slug === 'mehandi') {
        IconToUse = Hand;
      } else if (slug === 'cosmetic') {
        IconToUse = Sparkles;
      } else if (slug === 'jewelry') {
        IconToUse = Gem;
      } else if (slug === 'socks' || slug === 'clothing') {
        IconToUse = Shirt;
      } else if (slug === 'accessories') {
        IconToUse = Package;
      }

      const icon = IconToUse;
      return {
        title: title,
        description: "Browse products",
        image,
        icon,
        href: `/products?category=${encodeURIComponent(slug)}`,
        slug
      };
    }).filter((c): c is NonNullable<typeof c> => Boolean(c));

    // Force "Socks" if missing
    if (!processedCategories.find(c => c.slug === 'socks')) {
      const slug = 'socks';
      const image = getCategoryImage(slug) || getFallbackImage(processedCategories.length);
      processedCategories.push({
        title: "Socks",
        description: "Browse products",
        image,
        icon: Shirt,
        href: `/products?category=${encodeURIComponent(slug)}`,
        slug
      });
    }

    // Force "Cosmetic" if missing (e.g. if DB had no "beauty" and no "cosmetic")
    if (!processedCategories.find(c => c.slug === 'cosmetic')) {
      const slug = 'cosmetic';
      const image = getCategoryImage(slug) || getFallbackImage(processedCategories.length);
      processedCategories.push({
        title: "Cosmetic",
        description: "Browse products",
        image,
        icon: Sparkles,
        href: `/products?category=${encodeURIComponent(slug)}`,
        slug
      });
    }

    return processedCategories;
  }, [categories]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <Hero />

        <section id="categories" className="border-y border-border/50 bg-muted/10">
          <div className="container py-14 md:py-20">
            <div className="mx-auto max-w-3xl text-center mb-10 md:mb-12">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Shop by Category
              </h2>
              <p className="mt-3 text-muted-foreground text-base sm:text-lg">
                Explore curated collections across cosmetic, jewelry, and fashion accessories.
              </p>
            </div>

            <div className="mx-auto max-w-7xl">
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {homepageCategories.map((category) => (
                  <CategoryCard key={category.title} {...category} />
                ))}
              </div>
            </div>

            {!categoriesLoading && homepageCategories.length === 0 ? (
              <div className="mt-10 rounded-2xl border border-dashed border-border bg-background p-10 text-center">
                <p className="text-sm text-muted-foreground">No categories yet.</p>
                <p className="mt-2 text-sm">Go to <span className="font-medium">Admin → Categories</span> to add categories.</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="py-14 md:py-20">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center mb-10 md:mb-12">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Featured Products</h2>
              <p className="mt-3 text-muted-foreground text-base sm:text-lg">
                A quick look at what’s new and popular.
              </p>
            </div>

            {productsLoading ? (
              <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-border bg-background p-10 text-center">
                <p className="text-sm text-muted-foreground">Loading products…</p>
              </div>
            ) : productsError ? (
              <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-border bg-background p-10 text-center">
                <p className="text-sm text-muted-foreground">Couldn’t load products.</p>
                <p className="mt-2 text-sm text-muted-foreground">{productsError}</p>
              </div>
            ) : homepageProducts.length === 0 ? (
              <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-border bg-background p-10 text-center">
                <p className="text-sm text-muted-foreground">No products yet.</p>
                <p className="mt-2 text-sm">
                  Go to <span className="font-medium">Admin ? Products</span> to add your first product.
                </p>
              </div>
            ) : (
              <div className="mx-auto max-w-7xl">
                <div className="grid grid-cols-2 gap-2.5 xs:gap-3 sm:gap-5 lg:grid-cols-4">
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
