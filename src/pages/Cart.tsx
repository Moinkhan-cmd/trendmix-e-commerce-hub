import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useShop } from "@/store/shop";
import { Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
const Cart = () => {
  const { cartItems, cartCount, subtotal, setQty, removeFromCart, clearCart } = useShop();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 container py-8">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Your Cart</h1>
            <p className="text-muted-foreground mt-1">{cartCount} item(s)</p>
          </div>

          {cartItems.length > 0 && (
            <Button variant="outline" onClick={clearCart}>
              Clear cart
            </Button>
          )}
        </div>

        <Separator className="my-6" />

        {cartItems.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Cart is empty</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Add a few products to see them here.</p>
              <Button className="mt-4" asChild>
                <Link to="/products">Continue shopping</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              {cartItems.map((item) => (
                <Card key={item.product.id}>
                  <CardContent className="p-4 flex gap-4 items-center">
                    {item.product.image ? (
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="h-16 w-16 rounded-md object-cover border"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-md bg-muted" />
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.product.name}</p>
                      <p className="text-sm text-muted-foreground">₹{item.product.price}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="sr-only" htmlFor={`qty-${item.product.id}`}>
                        Quantity
                      </label>
                      <Input
                        id={`qty-${item.product.id}`}
                        type="number"
                        className="w-20"
                        min={1}
                        value={item.qty}
                        onChange={(e) => setQty(item.product.id, Number(e.target.value))}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromCart(item.product.id)}
                        aria-label={`Remove ${item.product.name} from cart`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{subtotal}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>Free</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between font-medium">
                  <span>Total</span>
                  <span>₹{subtotal}</span>
                </div>
                <Button className="w-full" disabled>
                  Checkout (demo)
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Cart;

