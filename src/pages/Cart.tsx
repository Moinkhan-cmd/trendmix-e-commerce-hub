import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useShop } from '@/store/shop';
import { Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import CheckoutAuthModal from '@/components/CheckoutAuthModal';
import { enableGuestCheckout } from '@/lib/checkout-session';

const Cart = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { cartItems, cartCount, subtotal, setQty, removeFromCart, clearCart } = useShop();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  
  // Calculate shipping: free if subtotal >= 500, else Rs.50
  const shipping = subtotal >= 500 ? 0 : 50;
  const total = subtotal + shipping;

  const handleProceedToCheckout = () => {
    if (isAuthenticated) {
      navigate('/checkout');
      return;
    }

    setAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 container py-6 sm:py-8">
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
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <ShoppingBag className="h-8 w-8 text-muted-foreground" />
              </div>
              <CardTitle>Your cart is empty</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-6">Add some products to see them here.</p>
              <Button asChild>
                <Link to="/products">
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  Continue shopping
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              {cartItems.map((item) => (
                <Card key={item.product.id} className="border-border/70 shadow-sm">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-3 sm:gap-4">
                    {item.product.image ? (
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="h-14 w-14 sm:h-16 sm:w-16 rounded-md object-cover border"
                      />
                    ) : (
                      <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-md bg-muted" />
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate leading-tight">{item.product.name}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                        <span>Rs.{item.product.price}</span>
                        <span>•</span>
                        <span>Qty {item.qty}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 rounded-md bg-muted/40 p-1">
                      <label className="sr-only" htmlFor={`qty-${item.product.id}`}>
                        Quantity
                      </label>
                      <Input
                        id={`qty-${item.product.id}`}
                        type="number"
                        className="w-14 sm:w-16 h-8"
                        min={1}
                        value={item.qty}
                        onChange={(e) => setQty(item.product.id, Number(e.target.value))}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeFromCart(item.product.id)}
                        aria-label={`Remove ${item.product.name} from cart`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="h-fit lg:sticky lg:top-4 border-border/70 shadow-sm bg-gradient-to-b from-background to-muted/25">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-base tracking-tight">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-1 pb-4 px-4">
                <div className="rounded-lg border border-border/70 bg-background/80 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal ({cartCount} items)</span>
                    <span className="font-medium">Rs.{subtotal}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="font-medium">
                      {shipping === 0 ? (
                        <span className="text-green-600 dark:text-green-400">Free</span>
                      ) : (
                        'Rs.' + shipping
                      )}
                    </span>
                  </div>
                </div>
                <div className="mt-2.5 mb-2 flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2">
                  <span className="font-medium">Total</span>
                  <span className="text-base font-semibold">Rs.{total}</span>
                </div>
                <Button className="w-full h-10 rounded-md" onClick={handleProceedToCheckout}>
                  Proceed to Checkout
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <CheckoutAuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        onSuccess={() => navigate('/checkout')}
        onContinueGuest={() => {
          enableGuestCheckout();
          setAuthModalOpen(false);
          navigate('/checkout');
        }}
      />

      <Footer />
    </div>
  );
};

export default Cart;
