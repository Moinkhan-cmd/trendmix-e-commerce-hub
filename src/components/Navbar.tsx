import { Heart, Menu, Search, ShoppingCart, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import logoImg from "@/assets/images/logo.png";
import { ThemeToggle } from "@/components/ThemeToggle";

type NavItem = {
  label: string;
  to: string;
  category?: "beauty" | "jewelry" | "socks" | "accessories" | "henna";
};

const NAV_ITEMS: NavItem[] = [
  { label: "All Products", to: "/products" },
  // Category slug is "beauty" in Firestore (AdminCategories seed + typical setup).
  { label: "Cosmetics", to: "/products?category=beauty", category: "beauty" },
  { label: "Jewelry", to: "/products?category=jewelry", category: "jewelry" },
  { label: "Socks", to: "/products?category=socks", category: "socks" },
  { label: "Accessories", to: "/products?category=accessories", category: "accessories" },
  { label: "Henna", to: "/products?category=henna", category: "henna" },
];

const Navbar = () => {
  const [cartCount] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300",
        isScrolled ? "bg-background/80 border-border/70 shadow-sm" : "bg-background/60 border-border/50",
      )}
    >
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-4 lg:gap-6 flex-shrink-0">
          <Link
            to="/"
            className="group flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Go to home"
          >
            <span className="relative flex-shrink-0">
              <img
                src={logoImg}
                alt="TrendMix logo"
                className="h-8 w-8 rounded-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="eager"
                decoding="async"
              />
              <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-border/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent transition-all duration-300 group-hover:tracking-wide">
              TrendMix
            </h1>
          </Link>

          <nav className="hidden lg:flex items-center space-x-1 text-sm font-medium">
            {NAV_ITEMS.map((item) => {
              const active = isNavItemActive(item);
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative px-3 py-2 rounded-md transition-colors duration-200 whitespace-nowrap",
                    "text-muted-foreground hover:text-foreground hover:bg-accent/40",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "after:absolute after:left-3 after:right-3 after:-bottom-0.5 after:h-[2px] after:rounded-full after:bg-primary",
                    "after:origin-left after:scale-x-0 after:transition-transform after:duration-300",
                    "hover:after:scale-x-100",
                    active && "text-foreground bg-accent/50 after:scale-x-100",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <div className="hidden md:flex items-center relative">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              className="pl-9 w-48 lg:w-64 rounded-full border-border/50 bg-background/50 transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden flex-shrink-0 transition-colors hover:bg-accent/50"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Button>

          <ThemeToggle />

          <Button
            variant="ghost"
            size="icon"
            className="hidden sm:inline-flex flex-shrink-0 transition-colors hover:bg-accent/50"
            aria-label="Wishlist"
            asChild
          >
            <Link to="/wishlist">
              <Heart className="h-5 w-5" />
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="hidden sm:inline-flex flex-shrink-0 transition-colors hover:bg-accent/50"
            aria-label="Account"
            asChild
          >
            <Link to="/account">
              <User className="h-5 w-5" />
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="relative flex-shrink-0 transition-colors hover:bg-accent/50"
            aria-label="Cart"
            asChild
          >
            <Link to="/cart">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
          </Button>

          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden flex-shrink-0 transition-colors hover:bg-accent/50"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-[300px] flex-col overflow-hidden sm:w-[350px]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <img
                    src={logoImg}
                    alt="TrendMix logo"
                    className="h-8 w-8 rounded-full object-cover"
                  />
                  <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    TrendMix
                  </span>
                </SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto overscroll-contain">
                {/* Mobile Search */}
                <div className="mt-6 md:hidden">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products..."
                      className="h-10 w-full rounded-full border-border/50 bg-background/50 pl-9"
                    />
                  </div>
                </div>

                {/* Mobile Navigation Links */}
                <nav className="mt-6 flex flex-col gap-1">
                  {NAV_ITEMS.map((item) => {
                    const active = isNavItemActive(item);
                    return (
                      <Link
                        key={item.label}
                        to={item.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center rounded-lg px-3 py-3 text-base font-medium transition-colors",
                          "hover:bg-accent hover:text-accent-foreground",
                          active && "bg-accent text-accent-foreground",
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>

                {/* Divider */}
                <div className="my-6 border-t border-border" />

                {/* Mobile Action Links */}
                <div className="flex flex-col gap-1">
                  <Link
                    to="/wishlist"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <Heart className="h-5 w-5" />
                    Wishlist
                  </Link>
                  <Link
                    to="/account"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <User className="h-5 w-5" />
                    Account
                  </Link>
                  <Link
                    to="/cart"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <ShoppingCart className="h-5 w-5" />
                    Cart
                    {cartCount > 0 && (
                      <span className="ml-auto h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                        {cartCount}
                      </span>
                    )}
                  </Link>
                </div>

                {/* Theme Toggle in Mobile */}
                <div className="mt-6 pt-6 border-t border-border">
                  <div className="flex items-center justify-between px-3">
                    <span className="text-sm text-muted-foreground">Theme</span>
                    <ThemeToggle />
                  </div>
                </div>

                <div className="h-6" />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
