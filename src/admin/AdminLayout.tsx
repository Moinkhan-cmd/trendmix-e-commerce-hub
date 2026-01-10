import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  BadgeDollarSign,
  Boxes,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Users,
  Settings,
  UserCircle,
  Menu,
  X,
  Search,
  Bell,
  Moon,
  Sun,
  ChevronDown,
  BarChart3,
  Activity,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAdminAuth } from "@/admin/AdminAuthProvider";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  badge?: string;
};

const navItems: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/products", label: "Products", icon: Boxes },
  { to: "/admin/categories", label: "Categories", icon: FolderKanban },
  { to: "/admin/orders", label: "Orders", icon: BadgeDollarSign },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/profile", label: "Profile", icon: UserCircle },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
];

function NavItemLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end as boolean | undefined}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )
      }
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
      {item.badge && (
        <Badge variant="secondary" className="ml-auto text-xs">
          {item.badge}
        </Badge>
      )}
    </NavLink>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="p-4 lg:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg">TrendMix</h2>
            <p className="text-xs text-muted-foreground">Admin Panel</p>
          </div>
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1 px-3 py-4">
        <div className="space-y-1">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Main Menu
          </p>
          {navItems.slice(0, 5).map((item) => (
            <NavItemLink key={item.to} item={item} onClick={onNavigate} />
          ))}
        </div>

        <Separator className="my-4" />

        <div className="space-y-1">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Reports & Settings
          </p>
          {navItems.slice(5).map((item) => (
            <NavItemLink key={item.to} item={item} onClick={onNavigate} />
          ))}
        </div>
      </ScrollArea>

      <Separator />

      <div className="p-4">
        <div className="rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm font-medium">Pro Tips</p>
              <p className="text-xs text-muted-foreground">
                Use Ctrl+K for quick search
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const { user, signOutAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const lastNotifiedOrderIdRef = useRef<string | null>(null);
  const ordersInitializedRef = useRef(false);

  // Get page title from current route
  const currentPage = navItems.find(
    (item) =>
      item.end
        ? location.pathname === item.to
        : location.pathname.startsWith(item.to) && item.to !== "/admin"
  ) || navItems[0];

  // Theme toggle
  useEffect(() => {
    const root = window.document.documentElement;
    const savedTheme = localStorage.getItem("admin-theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      root.classList.toggle("dark", savedTheme === "dark");
    }
  }, []);

  // Live store settings (used for the global notification toggle)
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "settings", "store"),
      (snap) => {
        if (!snap.exists()) return;
        const enabled = snap.data()?.enableNotifications;
        if (typeof enabled === "boolean") setNotificationsEnabled(enabled);
      },
      (err) => {
        console.error("Failed to subscribe to store settings:", err);
      }
    );

    return () => unsub();
  }, []);

  // In-app new order notifications (toast)
  useEffect(() => {
    if (!notificationsEnabled) return;

    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(1));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docSnap = snap.docs[0];
        if (!docSnap) return;

        const orderId = docSnap.id;
        const data = docSnap.data() as any;
        const orderNumber = typeof data?.orderNumber === "string" ? data.orderNumber : orderId.slice(0, 8);
        const total = typeof data?.total === "number" ? data.total : Number(data?.total ?? 0);

        // Avoid firing a notification on first load.
        if (!ordersInitializedRef.current) {
          ordersInitializedRef.current = true;
          lastNotifiedOrderIdRef.current = orderId;
          return;
        }

        if (lastNotifiedOrderIdRef.current === orderId) return;
        lastNotifiedOrderIdRef.current = orderId;

        toast.success(`New order received: ${orderNumber}`, {
          description: total ? `Total: Rs.${Number(total).toLocaleString("en-IN")}` : undefined,
          action: {
            label: "View",
            onClick: () => navigate("/admin/orders"),
          },
        });
      },
      (err) => {
        console.error("Failed to subscribe to latest order:", err);
      }
    );

    return () => unsub();
  }, [navigate, notificationsEnabled]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("admin-theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  // Command palette keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const onSignOut = async () => {
    await signOutAdmin();
    navigate("/admin/login", { replace: true });
  };

  const handleCommandSelect = (path: string) => {
    setCommandOpen(false);
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Command Palette */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Search pages, actions..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {navItems.map((item) => (
              <CommandItem
                key={item.to}
                onSelect={() => handleCommandSelect(item.to)}
                className="flex items-center gap-2"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => handleCommandSelect("/admin/products")}>
              <Boxes className="mr-2 h-4 w-4" />
              Add New Product
            </CommandItem>
            <CommandItem onSelect={() => handleCommandSelect("/admin/categories")}>
              <FolderKanban className="mr-2 h-4 w-4" />
              Add New Category
            </CommandItem>
            <CommandItem onSelect={toggleTheme}>
              {theme === "light" ? (
                <Moon className="mr-2 h-4 w-4" />
              ) : (
                <Sun className="mr-2 h-4 w-4" />
              )}
              Toggle Theme
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 border-r bg-card lg:block">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center gap-4 px-4 md:px-6">
            {/* Mobile Menu Button */}
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <SidebarContent onNavigate={() => setSidebarOpen(false)} />
              </SheetContent>
            </Sheet>

            {/* Page Title - Mobile */}
            <div className="flex-1 lg:hidden">
              <h1 className="font-semibold">{currentPage.label}</h1>
            </div>

            {/* Search Button */}
            <Button
              variant="outline"
              className="hidden h-9 w-64 justify-start text-muted-foreground md:flex"
              onClick={() => setCommandOpen(true)}
            >
              <Search className="mr-2 h-4 w-4" />
              Search...
              <kbd className="ml-auto pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>

            <div className="flex-1" />

            {/* Right Side Actions */}
            <div className="flex items-center gap-2">
              {/* Mobile Search */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setCommandOpen(true)}
              >
                <Search className="h-5 w-5" />
              </Button>

              {/* Theme Toggle */}
              <Button variant="ghost" size="icon" onClick={toggleTheme}>
                {theme === "light" ? (
                  <Moon className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
              </Button>

              {/* Notifications */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                      3
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                    <p className="text-sm font-medium">New order received</p>
                    <p className="text-xs text-muted-foreground">Order #12345 - ₹2,499</p>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                    <p className="text-sm font-medium">Low stock alert</p>
                    <p className="text-xs text-muted-foreground">5 products need restocking</p>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                    <p className="text-sm font-medium">New user registered</p>
                    <p className="text-xs text-muted-foreground">john@example.com joined</p>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="justify-center text-primary">
                    View all notifications
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                        {user?.email?.charAt(0).toUpperCase() || "A"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden flex-col items-start md:flex">
                      <span className="text-sm font-medium">Admin</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                        {user?.email}
                      </span>
                    </div>
                    <ChevronDown className="hidden h-4 w-4 text-muted-foreground md:block" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/admin/profile")}>
                    <UserCircle className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/admin/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onSignOut} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
