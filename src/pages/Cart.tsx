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
            <div className="space-y-3">
              {cartItems.map((item) => (
                <Card key={item.product.id} className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex gap-3 sm:gap-4">
                      {/* Product Image */}
                      {item.product.image ? (
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="h-[72px] w-[72px] sm:h-20 sm:w-20 flex-shrink-0 rounded-lg object-cover border border-border/40"
                        />
                      ) : (
                        <div className="h-[72px] w-[72px] sm:h-20 sm:w-20 flex-shrink-0 rounded-lg bg-muted flex items-center justify-center">
                          <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}

                      {/* Info column */}
                      <div className="flex-1 min-w-0 flex flex-col gap-2">
                        {/* Name + remove button */}
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm sm:text-base leading-snug line-clamp-2 flex-1">{item.product.name}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 flex-shrink-0 -mt-0.5 -mr-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                            onClick={() => removeFromCart(item.product.id)}
                            aria-label={`Remove ${item.product.name} from cart`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {/* Price · qty · total row */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/40 px-2 py-1">
                            <label className="sr-only" htmlFor={`qty-${item.product.id}`}>Quantity</label>
                            <span className="text-xs text-muted-foreground select-none">Qty</span>
                            <Input
                              id={`qty-${item.product.id}`}
                              type="number"
                              className="w-11 h-7 text-center border-0 bg-transparent p-0 text-sm font-semibold focus-visible:ring-1 focus-visible:ring-primary/50 rounded"
                              min={1}
                              value={item.qty}
                              onChange={(e) => setQty(item.product.id, Number(e.target.value))}
                            />
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] text-muted-foreground leading-none mb-0.5">
                              Rs.{item.product.price} × {item.qty}
                            </p>
                            <p className="text-sm font-bold text-foreground">Rs.{item.product.price * item.qty}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="h-fit lg:sticky lg:top-4 border-border/60 shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="pb-1 pt-4 px-4 bg-muted/20">
                <CardTitle className="text-base font-semibold tracking-tight">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-3 pb-4 px-4">
                <div className="rounded-lg border border-border/50 bg-muted/10 p-3 space-y-2">
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
                <div className="mt-3 flex items-center justify-between rounded-lg bg-primary/5 border border-primary/10 px-3 py-2.5">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold">Rs.{total}</span>
                </div>
                <Button className="w-full h-10 mt-3 rounded-lg font-medium" onClick={handleProceedToCheckout}>
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
