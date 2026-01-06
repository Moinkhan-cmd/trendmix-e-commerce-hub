import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import {
  CheckCircle,
  AlertCircle,
  ShoppingBag,
  Loader2,
  ArrowLeft,
  Package,
} from 'lucide-react';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { toast } from '@/components/ui/sonner';

import { useShop } from '@/store/shop';
import { createOrder } from '@/lib/orders';
import type { OrderItem, CustomerInfo } from '@/lib/models';

const checkoutSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  phone: z.string().min(1, 'Phone number is required').regex(/^\d{10}$/, 'Phone number must be exactly 10 digits'),
  address: z.string().min(10, 'Address must be at least 10 characters').max(500, 'Address is too long'),
  city: z.string().min(1, 'City is required').max(100, 'City name is too long'),
  state: z.string().min(1, 'State is required').max(100, 'State name is too long'),
  pincode: z.string().min(1, 'Pincode is required').regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
  notes: z.string().max(500, 'Notes are too long').optional(),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;
type CheckoutState = 'form' | 'loading' | 'success' | 'error';

const Checkout = () => {
  const { cartItems, subtotal, clearCart } = useShop();
  const [checkoutState, setCheckoutState] = useState<CheckoutState>('form');
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const shipping = subtotal >= 500 ? 0 : 50;
  const total = subtotal + shipping;

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { name: '', email: '', phone: '', address: '', city: '', state: '', pincode: '', notes: '' },
  });

  const onSubmit = async (data: CheckoutFormData) => {
    if (cartItems.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    setCheckoutState('loading');
    setErrorMessage('');
    try {
      const orderItems: OrderItem[] = cartItems.map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        qty: item.qty,
        price: item.product.price,
        imageUrl: item.product.image || '',
      }));
      const customer: CustomerInfo = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        notes: data.notes || undefined,
      };
      const result = await createOrder({ items: orderItems, customer, subtotal, shipping, total });
      setOrderNumber(result.orderNumber);
      setCheckoutState('success');
      clearCart();
      toast.success('Order placed successfully!');
    } catch (error) {
      console.error('Order creation failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
      setCheckoutState('error');
      toast.error('Failed to place order');
    }
  };

  if (cartItems.length === 0 && checkoutState === 'form') {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <ShoppingBag className="h-8 w-8 text-muted-foreground" />
              </div>
              <CardTitle>Your cart is empty</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-6">Add some products to your cart before checking out.</p>
              <Button asChild><Link to="/products"><ShoppingBag className="mr-2 h-4 w-4" />Browse Products</Link></Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (checkoutState === 'success') {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">Thank you for your order. We'll send you a confirmation email shortly.</p>
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Order Number</p>
                <p className="text-xl font-mono font-bold">{orderNumber}</p>
              </div>
              <p className="text-sm text-muted-foreground">Please save this order number for your reference.</p>
              <div className="pt-4">
                <Button asChild className="w-full"><Link to="/products"><ShoppingBag className="mr-2 h-4 w-4" />Continue Shopping</Link></Button>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (checkoutState === 'error') {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-2xl">Order Failed</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">{errorMessage || 'Something went wrong while placing your order.'}</p>
              <div className="flex flex-col gap-2 pt-4">
                <Button onClick={() => setCheckoutState('form')}>Try Again</Button>
                <Button variant="outline" asChild><Link to="/cart"><ArrowLeft className="mr-2 h-4 w-4" />Back to Cart</Link></Button>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-8">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="mb-4"><Link to="/cart"><ArrowLeft className="mr-2 h-4 w-4" />Back to Cart</Link></Button>
          <h1 className="text-3xl font-bold">Checkout</h1>
          <p className="text-muted-foreground mt-1">Complete your order by filling in the details below.</p>
        </div>
        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          <div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                  <CardHeader><CardTitle className="text-lg">Customer Information</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Full Name *</FormLabel><FormControl><Input placeholder="Enter your full name" {...field} disabled={checkoutState === 'loading'} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Email *</FormLabel><FormControl><Input type="email" placeholder="your@email.com" {...field} disabled={checkoutState === 'loading'} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem><FormLabel>Phone *</FormLabel><FormControl><Input type="tel" placeholder="10 digit mobile number" {...field} disabled={checkoutState === 'loading'} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-lg">Shipping Address</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <FormField control={form.control} name="address" render={({ field }) => (
                      <FormItem><FormLabel>Address *</FormLabel><FormControl><Textarea placeholder="House/Flat No., Building, Street, Locality" className="resize-none" rows={3} {...field} disabled={checkoutState === 'loading'} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField control={form.control} name="city" render={({ field }) => (
                        <FormItem><FormLabel>City *</FormLabel><FormControl><Input placeholder="City" {...field} disabled={checkoutState === 'loading'} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="state" render={({ field }) => (
                        <FormItem><FormLabel>State *</FormLabel><FormControl><Input placeholder="State" {...field} disabled={checkoutState === 'loading'} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="pincode" render={({ field }) => (
                      <FormItem className="sm:max-w-[200px]"><FormLabel>Pincode *</FormLabel><FormControl><Input placeholder="6 digit pincode" {...field} disabled={checkoutState === 'loading'} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-lg">Order Notes (Optional)</CardTitle></CardHeader>
                  <CardContent>
                    <FormField control={form.control} name="notes" render={({ field }) => (
                      <FormItem><FormControl><Textarea placeholder="Any special instructions for your order..." className="resize-none" rows={3} {...field} disabled={checkoutState === 'loading'} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </CardContent>
                </Card>
                <div className="lg:hidden">
                  <Button type="submit" size="lg" className="w-full" disabled={checkoutState === 'loading'}>
                    {checkoutState === 'loading' ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>) : (<><Package className="mr-2 h-4 w-4" />Place Order</> )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
          <div className="lg:sticky lg:top-4 h-fit">
            <Card>
              <CardHeader><CardTitle className="text-lg">Order Summary</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {cartItems.map((item) => (
                    <div key={item.product.id} className="flex items-center gap-3">
                      {item.product.image ? (<img src={item.product.image} alt={item.product.name} className="h-12 w-12 rounded-md object-cover border" />) : (<div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center"><Package className="h-5 w-5 text-muted-foreground" /></div>)}
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{item.product.name}</p><p className="text-xs text-muted-foreground">Qty: {item.qty} x Rs.{item.product.price}</p></div>
                      <p className="text-sm font-medium">Rs.{item.qty * item.product.price}</p>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Subtotal ({cartItems.reduce((sum, item) => sum + item.qty, 0)} items)</span><span>Rs.{subtotal}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Shipping</span><span>{shipping === 0 ? (<span className="text-green-600 dark:text-green-400">Free</span>) : ('Rs.' + shipping)}</span></div>
                  {shipping > 0 && (<p className="text-xs text-muted-foreground">Add Rs.{500 - subtotal} more for free shipping</p>)}
                </div>
                <Separator />
                <div className="flex items-center justify-between font-medium text-lg"><span>Total</span><span>Rs.{total}</span></div>
                <div className="hidden lg:block pt-2">
                  <Button type="submit" size="lg" className="w-full" disabled={checkoutState === 'loading'} onClick={form.handleSubmit(onSubmit)}>
                    {checkoutState === 'loading' ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>) : (<><Package className="mr-2 h-4 w-4" />Place Order</>)}
                  </Button>
                </div>
                <p className="text-xs text-center text-muted-foreground">By placing this order, you agree to our terms and conditions.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Checkout;
