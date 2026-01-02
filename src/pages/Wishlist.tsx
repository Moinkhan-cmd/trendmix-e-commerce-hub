import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useShop } from "@/store/shop";
import { HeartOff, ShoppingCart, Trash2 } from "lucide-react";

const Wishlist = () => {
  const { wishlistItems, wishlistCount, toggleWishlist, addToCart, clearWishlist } = useShop();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 container py-8">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Wishlist</h1>
            <p className="text-muted-foreground mt-1">{wishlistCount} item(s)</p>
          </div>

          {wishlistItems.length > 0 && (
            <Button variant="outline" onClick={clearWishlist}>
              Clear wishlist
            </Button>
          )}
        </div>

        <Separator className="my-6" />

        {wishlistItems.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Wishlist is empty</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Tap the heart icon on a product to save it.</p>
              <Button className="mt-4" asChild>
                <Link to="/products">Browse products</Link>
              </Button>
              <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
                <HeartOff className="h-4 w-4" />
                <span>No saved items yet.</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {wishlistItems.map((product) => (
              <Card key={product.id} className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-4">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-16 w-16 rounded-md object-cover border"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-md bg-muted" />
                    )}

                    <div className="min-w-0">
                      <p className="font-medium truncate">{product.name}</p>
                      <p className="text-sm text-muted-foreground">₹{product.price}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => addToCart(product, 1)}
                      aria-label={`Add ${product.name} to cart`}
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Add to cart
                    </Button>

                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => toggleWishlist(product)}
                      aria-label={`Remove ${product.name} from wishlist`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Wishlist;
