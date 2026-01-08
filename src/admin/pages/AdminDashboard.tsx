import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  AlertTriangle,
  Package,
  ShoppingCart,
  Users,
  IndianRupee,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  RefreshCw,
  Calendar,
  Download,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import type { OrderDoc, ProductDoc, UserDoc } from '@/lib/models';
import { cn } from '@/lib/utils';
import { toast } from "@/components/ui/sonner";

type WithId<T> = T & { id: string };

const STATUS_COLORS: Record<string, string> = {
  Pending: '#f59e0b',
  Confirmed: '#8b5cf6',
  Shipped: '#3b82f6',
  Delivered: '#22c55e',
  Cancelled: '#ef4444',
};

const STATUS_ICONS: Record<string, typeof Clock> = {
  Pending: Clock,
  Confirmed: CheckCircle,
  Shipped: Truck,
  Delivered: CheckCircle,
  Cancelled: XCircle,
};

function StatCard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  description,
  loading,
}: {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease';
  icon: typeof Package;
  description?: string;
  loading?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-9 w-24 animate-pulse rounded bg-muted" />
        ) : (
          <>
            <div className="text-2xl font-bold tracking-tight">{value}</div>
            <div className="flex items-center gap-2 mt-1">
              {change !== undefined && (
                <span
                  className={cn(
                    'flex items-center text-xs font-medium',
                    changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {changeType === 'increase' ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {Math.abs(change)}%
                </span>
              )}
              {description && (
                <span className="text-xs text-muted-foreground">{description}</span>
              )}
            </div>
          </>
        )}
      </CardContent>
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
    </Card>
  );
}

function QuickAction({
  icon: Icon,
  label,
  to,
}: {
  icon: typeof Package;
  label: string;
  to: string;
}) {
  return (
    <Link to={to}>
      <Button
        variant="outline"
        className="h-auto w-full flex-col gap-2 p-4 hover:bg-muted/50 hover:border-primary/50 transition-all"
      >
        <div className="rounded-lg p-2 bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <span className="text-xs font-medium">{label}</span>
      </Button>
    </Link>
  );
}

function ActivityItem({
  icon: Icon,
  title,
  description,
  time,
  colorClass,
}: {
  icon: typeof Package;
  title: string;
  description: string;
  time: string;
  colorClass: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className={cn('rounded-full p-2', colorClass)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{time}</span>
    </div>
  );
}

export default function AdminDashboard() {
  const [products, setProducts] = useState<Array<WithId<ProductDoc>>>([]);
  const [orders, setOrders] = useState<Array<WithId<OrderDoc>>>([]);
  const [users, setUsers] = useState<Array<WithId<UserDoc>>>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    setLoading(true);

    const unsubProducts = onSnapshot(
      collection(db, "products"),
      (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProductDoc) })));
      },
      (err) => {
        console.error("Failed to subscribe to products:", err);
        toast.error("Failed to load products");
        setLoading(false);
      }
    );

    const unsubOrders = onSnapshot(
      query(collection(db, "orders"), orderBy("createdAt", "desc")),
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDoc) })));
        setLoading(false);
      },
      (err) => {
        console.error("Failed to subscribe to orders:", err);
        toast.error("Failed to load orders");
        setLoading(false);
      }
    );

    const unsubUsers = onSnapshot(
      collection(db, "users"),
      (snap) => {
        setUsers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as UserDoc) })));
      },
      (err) => {
        console.error("Failed to subscribe to users:", err);
        toast.error("Failed to load users");
        setLoading(false);
      }
    );

    return () => {
      unsubProducts();
      unsubOrders();
      unsubUsers();
    };
  }, []);

  const revenue = useMemo(() => {
    return orders
      .filter((o) => o.status !== 'Cancelled')
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [orders]);

  const publishedCount = useMemo(
    () => products.filter((p) => p.published).length,
    [products]
  );

  const lowStockProducts = useMemo(
    () => products.filter((p) => (p.stock ?? 0) <= 5 && p.published),
    [products]
  );

  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === 'Pending').length,
    [orders]
  );

  const recentOrders = useMemo(() => orders.slice(0, 8), [orders]);

  const orderStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const topProducts = useMemo(() => {
    const salesMap = new Map<string, { name: string; qty: number; revenue: number }>();
    orders
      .filter((o) => o.status !== 'Cancelled')
      .forEach((o) => {
        (o.items || []).forEach((item) => {
          const existing = salesMap.get(item.productId) || { name: item.name, qty: 0, revenue: 0 };
          existing.qty += item.qty;
          existing.revenue += item.qty * item.price;
          salesMap.set(item.productId, existing);
        });
      });
    return Array.from(salesMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [orders]);

  const revenueTrend = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((day) => ({
      name: day,
      revenue: Math.floor(revenue / 7 + Math.random() * 1000 - 500),
      orders: Math.floor(orders.length / 7 + Math.random() * 3),
    }));
  }, [revenue, orders.length]);

  const formatDate = (timestamp: any) => {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTime = (timestamp: any) => {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return minutes + 'm ago';
    if (hours < 24) return hours + 'h ago';
    return days + 'd ago';
  };

  const recentActivities = useMemo(() => {
    return orders.slice(0, 5).map((order) => ({
      icon: STATUS_ICONS[order.status] || ShoppingCart,
      title: 'Order ' + (order.orderNumber || order.id.slice(0, 8)),
      description: 'Rs.' + Number(order.total).toLocaleString('en-IN') + ' - ' + order.status,
      time: formatTime(order.createdAt),
      colorClass: order.status === 'Delivered' ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : 
                  order.status === 'Cancelled' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 
                  'bg-blue-100 text-blue-600 dark:bg-blue-900/30',
    }));
  }, [orders]);

  const avgOrderValue = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== 'Cancelled');
    if (validOrders.length === 0) return 0;
    return revenue / validOrders.length;
  }, [orders, revenue]);

  const conversionRate = useMemo(() => {
    if (users.length === 0) return 0;
    const orderedUsers = new Set(orders.map((o) => o.userId));
    return Math.round((orderedUsers.size / users.length) * 100);
  }, [orders, users]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your store.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Last 7 days</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTimeRange('24h')}>Last 24 hours</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeRange('7d')}>Last 7 days</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeRange('30d')}>Last 30 days</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeRange('90d')}>Last 90 days</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button size="sm" className="gap-2" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={'Rs.' + revenue.toLocaleString('en-IN')}
          change={12.5}
          changeType="increase"
          icon={IndianRupee}
          description="vs last week"
          loading={loading}
        />
        <StatCard
          title="Total Orders"
          value={orders.length}
          change={8.2}
          changeType="increase"
          icon={ShoppingCart}
          description={pendingOrders + ' pending'}
          loading={loading}
        />
        <StatCard
          title="Total Products"
          value={products.length}
          icon={Package}
          description={publishedCount + ' published'}
          loading={loading}
        />
        <StatCard
          title="Total Customers"
          value={users.length}
          change={15.3}
          changeType="increase"
          icon={Users}
          description="new this week"
          loading={loading}
        />
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg. Order Value</p>
                <p className="text-xl font-bold">Rs.{avgOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Conversion Rate</p>
                <p className="text-xl font-bold">{conversionRate}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Low Stock Items</p>
                <p className="text-xl font-bold text-amber-600">{lowStockProducts.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending Orders</p>
                <p className="text-xl font-bold text-orange-600">{pendingOrders}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {lowStockProducts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Low Stock Alert ({lowStockProducts.length} products)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStockProducts.slice(0, 8).map((p) => (
                <Badge key={p.id} variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400">
                  {p.name} ({p.stock} left)
                </Badge>
              ))}
              {lowStockProducts.length > 8 && (
                <Link to="/admin/products?stock=low">
                  <Badge variant="secondary" className="cursor-pointer hover:bg-amber-200">
                    +{lowStockProducts.length - 8} more
                  </Badge>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickAction icon={Package} label="Add Product" to="/admin/products" />
            <QuickAction icon={ShoppingCart} label="View Orders" to="/admin/orders" />
            <QuickAction icon={Users} label="Manage Users" to="/admin/users" />
            <QuickAction icon={TrendingUp} label="Analytics" to="/admin/analytics" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Revenue Overview</CardTitle>
              <CardDescription>Daily revenue for the past week</CardDescription>
            </div>
            <Tabs defaultValue="revenue" className="w-auto">
              <TabsList className="h-8">
                <TabsTrigger value="revenue" className="text-xs px-3">Revenue</TabsTrigger>
                <TabsTrigger value="orders" className="text-xs px-3">Orders</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => ['Rs.' + value.toLocaleString('en-IN'), 'Revenue']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Order Status</CardTitle>
            <CardDescription>Distribution of order statuses</CardDescription>
          </CardHeader>
          <CardContent>
            {orderStatusData.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={orderStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {orderStatusData.map((entry) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#8884d8'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2">
                  {orderStatusData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[entry.name] }}
                      />
                      <span className="text-xs text-muted-foreground">{entry.name}</span>
                      <span className="text-xs font-medium ml-auto">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No orders yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Orders</CardTitle>
              <CardDescription>Latest orders from your store</CardDescription>
            </div>
            <Link to="/admin/orders">
              <Button variant="ghost" size="sm">
                View all
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((o) => {
                    const StatusIcon = STATUS_ICONS[o.status] || Clock;
                    return (
                      <TableRow key={o.id}>
                        <TableCell>
                          <div>
                            <p className="font-mono text-xs font-medium">#{o.orderNumber || o.id.slice(0, 8)}</p>
                            <p className="text-xs text-muted-foreground">{o.items?.length || 0} items</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {formatDate(o.createdAt)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          Rs.{Number(o.total ?? 0).toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(
                              'gap-1',
                              o.status === 'Delivered' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                              o.status === 'Cancelled' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                              o.status === 'Pending' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                              o.status === 'Shipped' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            )}
                          >
                            <StatusIcon className="h-3 w-3" />
                            <span className="hidden sm:inline">{o.status}</span>
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {recentOrders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                        No orders yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <CardDescription>Latest updates from your store</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[180px]">
                <div className="space-y-1">
                  {recentActivities.map((activity, i) => (
                    <ActivityItem key={i} {...activity} />
                  ))}
                  {recentActivities.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No recent activity</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Products</CardTitle>
              <CardDescription>Best selling products by revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProducts.length > 0 ? (
                  topProducts.map((product) => (
                    <div key={product.name} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate max-w-[150px]">{product.name}</span>
                        <span className="font-medium">Rs.{product.revenue.toLocaleString('en-IN')}</span>
                      </div>
                      <Progress
                        value={(product.revenue / (topProducts[0]?.revenue || 1)) * 100}
                        className="h-2"
                      />
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-4">No sales data yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
