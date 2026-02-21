import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  User,
  Mail,
  Phone,
  MapPin,
  LogOut,
  Loader2,
  CheckCircle,
  AlertCircle,
  ShoppingBag,
  Package,
  Edit,
  Save,
  X,
  ShieldCheck,
  Crown,
  Ban,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/auth/AuthProvider";
import { getOrdersByEmail, formatCurrency, formatOrderDate } from "@/lib/orders";
import type { OrderDoc } from "@/lib/models";
import { cancelOrder } from "@/lib/shiprocket";
import { toast } from "@/components/ui/sonner";

const profileSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  country: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const statusColors: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  Confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  Shipped: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  Delivered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  Cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function Account() {
  const navigate = useNavigate();
  const { user, profile, isAuthenticated, loading: authLoading, signOut, updateProfile, error, clearError } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [orders, setOrders] = useState<Array<OrderDoc & { id: string }>>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: "",
      phone: "",
      street: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
    },
  });

  // Reset form when profile changes
  useEffect(() => {
    if (profile) {
      reset({
        displayName: profile.displayName || "",
        phone: profile.phone || "",
        street: profile.address?.street || "",
        city: profile.address?.city || "",
        state: profile.address?.state || "",
        pincode: profile.address?.pincode || "",
        country: profile.address?.country || "India",
      });
    }
  }, [profile, reset]);

  // Fetch orders when authenticated
  useEffect(() => {
    async function fetchOrders() {
      if (!user?.email) return;
      
      setOrdersLoading(true);
      setOrdersError(null);
      
      try {
        const userOrders = await getOrdersByEmail(user.email);
        setOrders(userOrders);
      } catch (err) {
        console.error("Failed to fetch orders:", err);
        setOrdersError("Failed to load order history");
      } finally {
        setOrdersLoading(false);
      }
    }

    if (isAuthenticated && user?.email) {
      fetchOrders();
    }
  }, [isAuthenticated, user?.email]);

  const onSubmit = async (data: ProfileFormData) => {
    setIsSaving(true);
    setSaveSuccess(false);
    clearError();

    try {
      await updateProfile({
        displayName: data.displayName,
        phone: data.phone,
        address: {
          street: data.street || "",
          city: data.city || "",
          state: data.state || "",
          pincode: data.pincode || "",
          country: data.country || "India",
        },
      });
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update profile:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (err) {
      console.error("Failed to sign out:", err);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (profile) {
      reset({
        displayName: profile.displayName || "",
        phone: profile.phone || "",
        street: profile.address?.street || "",
        city: profile.address?.city || "",
        state: profile.address?.state || "",
        pincode: profile.address?.pincode || "",
        country: profile.address?.country || "India",
      });
    }
  };

  const handleCancelOrder = async (orderId: string, orderNumber: string) => {
    if (!confirm(`Cancel order ${orderNumber}? This cannot be undone.`)) return;
    setCancellingOrderId(orderId);
    try {
      const result = await cancelOrder(orderId);
      if (result.success) {
        toast.success(result.message || "Order cancelled successfully");
        // Update order in local state
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId ? { ...o, status: "Cancelled" as const, shipment_status: "cancelled" as const } : o
          )
        );
      } else {
        toast.error(result.message || "Failed to cancel order");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel order");
    } finally {
      setCancellingOrderId(null);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Show loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-background to-muted/30">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading your account...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-background to-muted/30">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md text-center">
            <CardHeader className="space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
              <CardTitle className="text-2xl">Log In Required</CardTitle>
              <CardDescription>
                Please log in to view your account and order history.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild className="flex-1">
                  <Link to="/login">Log In</Link>
                </Button>
                <Button variant="outline" asChild className="flex-1">
                  <Link to="/signup">Create Account</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background to-muted/30">
      <Navbar />

      <main className="flex-1 container py-8 md:py-12">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">My Account</h1>
              <p className="text-muted-foreground">Manage your profile and view orders</p>
            </div>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="gap-2 w-full sm:w-auto"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>

          {/* Success Alert */}
          {saveSuccess && (
            <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/30">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                Profile updated successfully!
              </AlertDescription>
            </Alert>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
              <TabsTrigger value="profile" className="gap-2">
                <User className="h-4 w-4 hidden sm:block" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="orders" className="gap-2">
                <ShoppingBag className="h-4 w-4 hidden sm:block" />
                Orders
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-6">
              {/* Profile Card */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16 md:h-20 md:w-20">
                        <AvatarImage src={profile?.photoURL || user?.photoURL || undefined} />
                        <AvatarFallback className="text-lg md:text-xl bg-primary/10 text-primary">
                          {getInitials(profile?.displayName || user?.displayName || "User")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <h2 className="text-xl md:text-2xl font-semibold">
                          {profile?.displayName || user?.displayName || "User"}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={profile?.role === "admin" ? "default" : "secondary"}
                            className="gap-1"
                          >
                            {profile?.role === "admin" ? (
                              <Crown className="h-3 w-3" />
                            ) : (
                              <User className="h-3 w-3" />
                            )}
                            {profile?.role === "admin" ? "Admin" : "Customer"}
                          </Badge>
                          {profile?.emailVerified && (
                            <Badge variant="outline" className="gap-1 text-green-600 border-green-600/30">
                              <ShieldCheck className="h-3 w-3" />
                              Verified
                            </Badge>
                          )}
                          {!profile?.emailVerified && (
                            <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-600/30">
                              <AlertCircle className="h-3 w-3" />
                              Unverified
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {!isEditing && (
                      <Button
                        variant="outline"
                        onClick={() => setIsEditing(true)}
                        className="gap-2 w-full sm:w-auto"
                      >
                        <Edit className="h-4 w-4" />
                        Edit Profile
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <Separator />

                <CardContent className="pt-6">
                  {isEditing ? (
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="displayName">Full Name</Label>
                          <Input
                            id="displayName"
                            placeholder="Enter your name"
                            {...register("displayName")}
                          />
                          {errors.displayName && (
                            <p className="text-sm text-destructive">{errors.displayName.message}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone Number</Label>
                          <Input
                            id="phone"
                            placeholder="Enter phone number"
                            {...register("phone")}
                          />
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h3 className="font-medium flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Address Information
                        </h3>

                        <div className="space-y-2">
                          <Label htmlFor="street">Street Address</Label>
                          <Input
                            id="street"
                            placeholder="Enter street address"
                            {...register("street")}
                          />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="city">City</Label>
                            <Input
                              id="city"
                              placeholder="Enter city"
                              {...register("city")}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="state">State</Label>
                            <Input
                              id="state"
                              placeholder="Enter state"
                              {...register("state")}
                            />
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="pincode">Pincode</Label>
                            <Input
                              id="pincode"
                              placeholder="Enter pincode"
                              {...register("pincode")}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="country">Country</Label>
                            <Input
                              id="country"
                              placeholder="Enter country"
                              {...register("country")}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                          className="gap-2 flex-1 sm:flex-none"
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={isSaving}
                          className="gap-2 flex-1 sm:flex-none"
                        >
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          {isSaving ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <Mail className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Email</p>
                            <p className="font-medium">{user?.email || "Not provided"}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <Phone className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Phone</p>
                            <p className="font-medium">{profile?.phone || "Not provided"}</p>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h3 className="font-medium flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Address
                        </h3>
                        {profile?.address?.street ? (
                          <div className="text-muted-foreground">
                            <p>{profile.address.street}</p>
                            <p>
                              {[profile.address.city, profile.address.state, profile.address.pincode]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                            <p>{profile.address.country}</p>
                          </div>
                        ) : (
                          <p className="text-muted-foreground">No address saved</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Orders Tab */}
            <TabsContent value="orders" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Order History
                  </CardTitle>
                  <CardDescription>
                    View and track your past orders
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {ordersLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center space-y-4">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                        <p className="text-muted-foreground">Loading orders...</p>
                      </div>
                    </div>
                  ) : ordersError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{ordersError}</AlertDescription>
                    </Alert>
                  ) : orders.length === 0 ? (
                    <div className="text-center py-12 space-y-4">
                      <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold">No orders yet</h3>
                        <p className="text-muted-foreground">
                          Start shopping to see your orders here.
                        </p>
                      </div>
                      <Button asChild>
                        <Link to="/products">Browse Products</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order) => (
                        <div
                          key={order.id}
                          className="border rounded-lg p-4 space-y-3 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-medium text-sm">
                                  {order.orderNumber}
                                </span>
                                <Badge className={statusColors[order.status] || "bg-gray-100"}>
                                  {order.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {formatOrderDate(order.createdAt)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{formatCurrency(order.total)}</p>
                              <p className="text-sm text-muted-foreground">
                                {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>

                          <Separator />

                          <div className="space-y-2">
                            {order.items.slice(0, 3).map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-3 text-sm"
                              >
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-10 h-10 object-cover rounded"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="truncate">{item.name}</p>
                                  <p className="text-muted-foreground">
                                    Qty: {item.qty} × {formatCurrency(item.price)}
                                  </p>
                                </div>
                              </div>
                            ))}
                            {order.items.length > 3 && (
                              <p className="text-sm text-muted-foreground">
                                +{order.items.length - 3} more item{order.items.length - 3 !== 1 ? "s" : ""}
                              </p>
                            )}
                          </div>

                          <div className="pt-2 flex flex-col sm:flex-row gap-2">
                            <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                              <Link to={`/order-tracking?orderNumber=${order.orderNumber}`}>
                                Track Order
                              </Link>
                            </Button>
                            {order.status !== "Cancelled" && order.status !== "Delivered" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full sm:w-auto text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
                                disabled={cancellingOrderId === order.id}
                                onClick={() => handleCancelOrder(order.id, order.orderNumber)}
                              >
                                {cancellingOrderId === order.id ? (
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Ban className="mr-1.5 h-3.5 w-3.5" />
                                )}
                                Cancel Order
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
}
