import { Heart, Menu, Search, ShoppingCart, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import logoImg from "@/assets/images/logo.png";
import { ThemeToggle } from "@/components/ThemeToggle";

type NavItem = {
  label: string;
  to: string;
  category?: "cosmetics" | "jewelry" | "socks" | "accessories";
};

const NAV_ITEMS: NavItem[] = [
  { label: "All Products", to: "/products" },
  { label: "Cosmetics", to: "/products?category=cosmetics", category: "cosmetics" },
  { label: "Jewelry", to: "/products?category=jewelry", category: "jewelry" },
  { label: "Socks", to: "/products?category=socks", category: "socks" },
  { label: "Accessories", to: "/products?category=accessories", category: "accessories" },
];

const Navbar = () => {
  const [cartCount] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);

  const location = useLocation();
  const locationSearchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  const isProductsPage = location.pathname === "/products";
  const activeCategory = locationSearchParams.get("category");

  const isNavItemActive = (item: NavItem) => {
    if (!isProductsPage) return false;
    if (!item.category) return !activeCategory;
    return activeCategory === item.category;
  };

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300",
        isScrolled ? "bg-background/80 border-border/70 shadow-sm" : "bg-background/60 border-border",
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="group flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Go to home"
          >
            <span className="relative">
              <img
                src={logoImg}
                alt="TrendMix logo"
                className="h-8 w-8 rounded-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="eager"
                decoding="async"
              />
              <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-border/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </span>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent transition-all duration-300 group-hover:tracking-wide">
              TrendMix
            </h1>
          </Link>

          <nav className="hidden md:flex items-center space-x-1 text-sm font-medium">
            {NAV_ITEMS.map((item) => {
              const active = isNavItemActive(item);
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative px-3 py-2 rounded-md transition-colors duration-200",
                    "text-muted-foreground hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "after:absolute after:left-2 after:right-2 after:-bottom-0.5 after:h-[2px] after:rounded-full after:bg-primary",
                    "after:origin-left after:scale-x-0 after:transition-transform after:duration-300",
                    "hover:after:scale-x-100",
                    active && "text-primary after:scale-x-100",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center relative">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              className="pl-9 w-64 transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Search">
            <Search className="h-5 w-5" />
          </Button>

          <ThemeToggle />

          <Button
            variant="ghost"
            size="icon"
            className="transition-transform hover:scale-105"
            aria-label="Wishlist"
          >
            <Heart className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="transition-transform hover:scale-105"
            aria-label="Account"
          >
            <User className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="relative transition-transform hover:scale-105"
            aria-label="Cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Button>

          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
