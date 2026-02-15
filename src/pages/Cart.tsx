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
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              {cartItems.map((item) => (
                <Card key={item.product.id}>
                  <CardContent className="p-3 sm:p-4 flex gap-3 sm:gap-4 items-center">
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
                      <p className="font-medium text-sm sm:text-base truncate">{item.product.name}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Rs.{item.product.price}</p>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <label className="sr-only" htmlFor={`qty-${item.product.id}`}>
                        Quantity
                      </label>
                      <Input
                        id={`qty-${item.product.id}`}
                        type="number"
                        className="w-16 sm:w-20 h-9"
                        min={1}
                        value={item.qty}
                        onChange={(e) => setQty(item.product.id, Number(e.target.value))}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 sm:h-9 sm:w-9"
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

            <Card className="h-fit lg:sticky lg:top-4 border-border/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal ({cartCount} items)</span>
                  <span>Rs.{subtotal}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>
                    {shipping === 0 ? (
                      <span className="text-green-600 dark:text-green-400">Free</span>
                    ) : (
                      'Rs.' + shipping
                    )}
                  </span>
                </div>
                {shipping > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Add Rs.{500 - subtotal} more for free shipping
                  </p>
                )}
                <Separator />
                <div className="flex items-center justify-between font-semibold">
                  <span>Total</span>
                  <span>Rs.{total}</span>
                </div>
                <Button className="w-full" onClick={handleProceedToCheckout}>
                  Proceed to Checkout
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/products">Continue Shopping</Link>
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
