import { Check, ChevronDown, Heart, LayoutGrid, Menu, Search, ShoppingCart, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import logoImg from "@/assets/logo.png";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CategoryDoc } from "@/lib/models";
import { getCategoryImage, getCategorySlug } from "@/lib/category-images";
import { useShop } from "@/store/shop";

type NavItem = {
  label: string;
  to: string;
  category?: "cosmetic" | "jewelry" | "socks" | "accessories" | "henna";
};

const NAV_ITEMS: NavItem[] = [
  { label: "All Products", to: "/products" },
  // Category slug is "cosmetic" in Firestore (AdminCategories seed + typical setup).
  { label: "Cosmetics", to: "/products?category=cosmetic", category: "cosmetic" },
  { label: "Jewelry", to: "/products?category=jewelry", category: "jewelry" },
  { label: "Socks", to: "/products?category=socks", category: "socks" },
  { label: "Accessories", to: "/products?category=accessories", category: "accessories" },
  { label: "Henna", to: "/products?category=henna", category: "henna" },
];

const Navbar = () => {
  const { cartCount, wishlistCount } = useShop();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [categoryImagesBySlug, setCategoryImagesBySlug] = useState<Record<string, string>>({});

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

  // Optional: use category images from Firestore when present.
  // Falls back to local images for the default categories.
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "categories"),
      (snap) => {
        const next: Record<string, string> = {};
        snap.docs.forEach((d) => {
          const data = d.data() as CategoryDoc;
          const slug = String(data.slug ?? "").toLowerCase().trim();
          const imageUrl = String(data.imageUrl ?? "").trim();
          if (slug && imageUrl) next[slug] = imageUrl;
        });
        setCategoryImagesBySlug(next);
      },
      () => {
        // Keep fallbacks only on error.
        setCategoryImagesBySlug({});
      },
    );

    return () => unsub();
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileCategoriesOpen(false);
    setMobileSearchOpen(false);
  }, [location.pathname, location.search]);

  const activeCategoryLabel = useMemo(() => {
    if (!isProductsPage) return null;
    if (!activeCategory) return "All Products";
    return NAV_ITEMS.find((i) => i.category === activeCategory)?.label ?? null;
  }, [activeCategory, isProductsPage]);

  const getCategoryThumb = (slug: string | undefined) => {
    if (!slug) return undefined;
    const canonical = getCategorySlug(slug, slug);

    // Prefer local/static mappings first; fall back to Firestore URLs (custom categories).
    return (
      getCategoryImage(canonical) ||
      categoryImagesBySlug[canonical] ||
      getCategoryImage(slug) ||
      categoryImagesBySlug[slug]
    );
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300",
        isScrolled ? "bg-background/80 border-border/70 shadow-sm" : "bg-background/60 border-border/50",
      )}
    >
      <div className="container flex h-14 sm:h-16 items-center gap-2 sm:gap-3 px-3 sm:px-4 lg:px-6">
        {/* Logo */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <Link
            to="/"
            className="group flex items-center gap-1.5 sm:gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Go to home"
          >
            <span className="relative flex-shrink-0">
              <img
                src={logoImg}
                alt="TrendMix logo"
                className="h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="eager"
                decoding="async"
              />
              <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-border/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </span>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent transition-all duration-300 group-hover:tracking-wide hidden sm:block">
              TrendMix
            </h1>
          </Link>
        </div>

        {/* Desktop Search - hidden on mobile */}
        <div className="flex-1 flex items-center justify-center">
          <div className="relative hidden md:block w-full max-w-[400px] lg:max-w-[520px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              className="h-9 lg:h-10 w-full rounded-full border-border/50 bg-background/60 pl-9 pr-3 transition-colors focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2">
          {/* Mobile Search Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 transition-colors hover:bg-accent/50"
            aria-label={mobileSearchOpen ? "Close search" : "Open search"}
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
          >
            {mobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </Button>

          {/* Categories: Dropdown (desktop) + Sheet (mobile) */}
          <div className="hidden lg:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 lg:h-10 rounded-full border-border/50 bg-background/40 px-3 lg:px-4 font-medium hover:bg-accent/40"
                >
                  <span className="truncate max-w-[120px] lg:max-w-[140px]">
                    {activeCategoryLabel ?? "Categories"}
                  </span>
                  <ChevronDown className="ml-1.5 lg:ml-2 h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[320px] lg:w-[360px] p-2">
                <DropdownMenuLabel className="px-2">Categories</DropdownMenuLabel>

                {/* All Products (full width) */}
                {(() => {
                  const item = NAV_ITEMS[0];
                  const active = isNavItemActive(item);
                  return (
                    <DropdownMenuItem asChild>
                      <Link
                        to={item.to}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center justify-between rounded-md px-2 py-2 text-sm",
                          active
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground/90 hover:bg-accent/50",
                        )}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="grid h-7 w-7 place-items-center rounded-md border border-border bg-muted">
                            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                          </span>
                          <span className="truncate">{item.label}</span>
                        </span>
                        {active ? <Check className="h-4 w-4 text-primary" /> : null}
                      </Link>
                    </DropdownMenuItem>
                  );
                })()}

                <DropdownMenuSeparator />

                {/* Category grid (2 columns) */}
                <div className="grid grid-cols-2 gap-1 p-1">
                  {NAV_ITEMS.slice(1).map((item) => {
                    const active = isNavItemActive(item);
                    const thumb = getCategoryThumb(item.category);
                    return (
                      <DropdownMenuItem key={item.label} asChild>
                        <Link
                          to={item.to}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center justify-between rounded-md px-2 py-2 text-sm",
                            active
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground/90 hover:bg-accent/50",
                          )}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt=""
                                className="h-7 w-7 rounded-md border border-border object-cover"
                                loading="eager"
                                decoding="async"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  // Replace broken thumbnails with a consistent placeholder block.
                                  const img = e.currentTarget;
                                  img.style.display = "none";
                                }}
                              />
                            ) : null}
                            {!thumb ? (
                              <span className="h-7 w-7 rounded-md border border-border bg-muted" />
                            ) : null}
                            <span className="truncate">{item.label}</span>
                          </span>
                          {active ? <Check className="h-4 w-4 text-primary" /> : null}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Menu Sheet */}
          <Sheet open={mobileCategoriesOpen} onOpenChange={setMobileCategoriesOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden h-9 w-9 sm:h-10 sm:w-10 rounded-full border-border/50 bg-background/40 hover:bg-accent/40"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-[280px] xs:w-[320px] sm:w-[380px] flex-col overflow-hidden p-0">
              <SheetHeader className="px-4 pt-4 pb-2 border-b">
                <SheetTitle className="flex items-center gap-2">
                  <img src={logoImg} alt="TrendMix logo" className="h-8 w-8 rounded-full object-cover" />
                  <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    TrendMix
                  </span>
                </SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
                {/* Quick Links */}
                <div className="mb-4 pb-4 border-b">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">Quick Links</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <Link
                      to="/cart"
                      onClick={() => setMobileCategoriesOpen(false)}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-accent/30 hover:bg-accent transition-colors"
                    >
                      <div className="relative">
                        <ShoppingCart className="h-5 w-5" />
                        {cartCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                            {cartCount}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-medium">Cart</span>
                    </Link>
                    <Link
                      to="/wishlist"
                      onClick={() => setMobileCategoriesOpen(false)}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-accent/30 hover:bg-accent transition-colors"
                    >
                      <div className="relative">
                        <Heart className="h-5 w-5" />
                        {wishlistCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                            {wishlistCount}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-medium">Wishlist</span>
                    </Link>
                    <Link
                      to="/account"
                      onClick={() => setMobileCategoriesOpen(false)}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-accent/30 hover:bg-accent transition-colors"
                    >
                      <User className="h-5 w-5" />
                      <span className="text-xs font-medium">Account</span>
                    </Link>
                  </div>
                </div>

                {/* Categories */}
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">Categories</h3>
                <nav className="flex flex-col gap-1">
                  {NAV_ITEMS.map((item) => {
                    const active = isNavItemActive(item);
                    const thumb = getCategoryThumb(item.category);
                    return (
                      <Link
                        key={item.label}
                        to={item.to}
                        onClick={() => setMobileCategoriesOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          "hover:bg-accent hover:text-accent-foreground active:scale-[0.98]",
                          active && "bg-accent text-accent-foreground",
                        )}
                      >
                        <span className="flex items-center gap-3">
                          {item.category ? (
                            thumb ? (
                              <img
                                src={thumb}
                                alt=""
                                className="h-8 w-8 rounded-lg border border-border object-cover"
                                loading="eager"
                                decoding="async"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  const img = e.currentTarget;
                                  img.style.display = "none";
                                }}
                              />
                            ) : (
                              <span className="h-8 w-8 rounded-lg border border-border bg-muted" />
                            )
                          ) : (
                            <span className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-muted">
                              <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                            </span>
                          )}
                          <span>{item.label}</span>
                        </span>
                        {active ? <Check className="h-4 w-4 text-primary" /> : null}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* Footer Links */}
              <div className="px-4 py-3 border-t bg-muted/30">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <Link to="/about" onClick={() => setMobileCategoriesOpen(false)} className="hover:text-foreground transition-colors">About</Link>
                  <Link to="/contact" onClick={() => setMobileCategoriesOpen(false)} className="hover:text-foreground transition-colors">Contact</Link>
                  <Link to="/faq" onClick={() => setMobileCategoriesOpen(false)} className="hover:text-foreground transition-colors">FAQ</Link>
                  <Link to="/shipping" onClick={() => setMobileCategoriesOpen(false)} className="hover:text-foreground transition-colors">Shipping</Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Desktop action buttons */}
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 transition-colors hover:bg-accent/50 hidden sm:inline-flex"
            aria-label="Cart"
            asChild
          >
            <Link to="/cart">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-primary text-primary-foreground text-[10px] sm:text-xs flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 transition-colors hover:bg-accent/50 hidden sm:inline-flex"
            aria-label="Wishlist"
            asChild
          >
            <Link to="/wishlist">
              <Heart className="h-5 w-5" />
              {wishlistCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 h-4 min-w-4 sm:h-5 sm:min-w-5 px-0.5 sm:px-1 rounded-full bg-primary text-primary-foreground text-[10px] sm:text-xs flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 transition-colors hover:bg-accent/50 hidden sm:inline-flex"
            aria-label="Profile"
            asChild
          >
            <Link to="/account">
              <User className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Mobile Search Bar - slides down when open */}
      <div
        className={cn(
          "md:hidden overflow-hidden transition-all duration-300 ease-in-out border-t border-border/50",
          mobileSearchOpen ? "max-h-16 opacity-100" : "max-h-0 opacity-0 border-t-0"
        )}
      >
        <div className="container px-3 sm:px-4 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              className="h-10 w-full rounded-full border-border/50 bg-background/80 pl-9 pr-3 transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              autoFocus={mobileSearchOpen}
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
