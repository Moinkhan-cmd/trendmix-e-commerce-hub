import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Heart, ShoppingCart } from "lucide-react";
import { db } from "@/lib/firebase";
import type { ProductDoc } from "@/lib/models";
import { useShop } from "@/store/shop";

type ProductWithId = ProductDoc & { id: string };

const ProductDetail = () => {
  const { id } = useParams();
  const { addToCart, toggleWishlist, isWishlisted } = useShop();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<ProductWithId | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) {
        setLoading(false);
        setProduct(null);
        return;
      }

      setLoading(true);
      setLoadError(null);

      try {
        const snap = await getDoc(doc(db, "products", id));
        if (cancelled) return;

        if (!snap.exists()) {
          setProduct(null);
          setLoading(false);
          return;
        }

        const data = snap.data() as ProductDoc;
        if (!data.published) {
          setProduct(null);
          setLoading(false);
          return;
        }

        setProduct({ id: snap.id, ...data });
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setLoading(false);
        setLoadError(e?.message ?? "Failed to load product");
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const imageUrl = useMemo(() => {
    if (!product?.imageUrls?.length) return undefined;
    return product.imageUrls[0];
  }, [product]);

  const wished = isWishlisted(id ?? "");

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 container py-10">
        {loading ? (
          <div className="rounded-xl border border-dashed border-border bg-background p-10 text-center">
            <h1 className="text-2xl font-semibold">Loading product…</h1>
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-dashed border-border bg-background p-10 text-center">
            <h1 className="text-2xl font-semibold">Couldn’t load product</h1>
            <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
            <div className="mt-6">
              <Button asChild variant="outline">
                <Link to="/products">Back to Products</Link>
              </Button>
            </div>
          </div>
        ) : !product ? (
          <div className="rounded-xl border border-dashed border-border bg-background p-10 text-center">
            <h1 className="text-2xl font-semibold">Product not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">This product isn’t available.</p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button asChild variant="outline">
                <Link to="/products">Back to Products</Link>
              </Button>
              <Button asChild>
                <Link to="/admin/login">Go to Admin</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-2">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="aspect-square bg-muted">
                  {imageUrl ? (
                    <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full" />
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div>
                <h1 className="text-3xl font-bold">{product.name}</h1>
                <p className="mt-2 text-2xl font-semibold">₹{Number(product.price ?? 0)}</p>
              </div>

              <Separator />

              {product.description ? (
                <p className="text-muted-foreground whitespace-pre-line">{product.description}</p>
              ) : (
                <p className="text-muted-foreground">No description provided.</p>
              )}

              <div className="text-sm text-muted-foreground">
                Stock: <span className="font-medium text-foreground">{Number(product.stock ?? 0)}</span>
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  onClick={() =>
                    addToCart(
                      {
                        id: product.id,
                        name: product.name,
                        price: Number(product.price ?? 0),
                        image: imageUrl,
                      },
                      1,
                    )
                  }
                  disabled={Number(product.stock ?? 0) <= 0}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Add to cart
                </Button>

                <Button
                  variant="outline"
                  onClick={() =>
                    toggleWishlist({
                      id: product.id,
                      name: product.name,
                      price: Number(product.price ?? 0),
                      image: imageUrl,
                    })
                  }
                  aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
                >
                  <Heart className={wished ? "h-4 w-4 fill-primary text-primary" : "h-4 w-4"} />
                </Button>
              </div>

              <div>
                <Button asChild variant="outline">
                  <Link to="/products">Back to Products</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default ProductDetail;
