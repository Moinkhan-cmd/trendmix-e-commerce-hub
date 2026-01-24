import { Check, ChevronDown, Heart, LayoutGrid, Menu, Mic, MicOff, Search, ShoppingCart, User, X } from "lucide-react";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logoImg from "@/assets/logo.png";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CategoryDoc, ProductDoc } from "@/lib/models";
import { getCategoryImage, getCategorySlug } from "@/lib/category-images";
import { buildUiCategoriesFromDocs } from "@/lib/ui-categories";
import { useShop } from "@/store/shop";
import { formatCurrency } from "@/lib/orders";
import { useVoiceSearch } from "@/hooks/use-voice-search";

type WithId<T> = T & { id: string };

function isPublished(value: unknown): boolean {
  if (value === true) return true;
  if (value === 1) return true;
  if (typeof value === "string") return value.toLowerCase().trim() === "true";
  return false;
}

type SearchProduct = WithId<Pick<ProductDoc, "name" | "price" | "imageUrls" | "description" | "brand" | "sku" | "tags" | "published" | "gender">>;

type NavItem = {
  label: string;
  to: string;
  category?: string;
};

const Navbar = () => {
  const { cartCount, wishlistCount } = useShop();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollY = useRef(0);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [desktopCategoryDropdownOpen, setDesktopCategoryDropdownOpen] = useState(false);
  const [categoryImagesBySlug, setCategoryImagesBySlug] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Array<WithId<CategoryDoc>>>([]);

  const [searchCatalog, setSearchCatalog] = useState<SearchProduct[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);

  const navigate = useNavigate();

  const location = useLocation();
  const locationSearchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  const isProductsPage = location.pathname === "/products";
  const activeCategoryRaw = locationSearchParams.get("category");
  const activeCategory = activeCategoryRaw ? getCategorySlug(activeCategoryRaw, activeCategoryRaw) : null;
  const activeQuery = locationSearchParams.get("q") ?? "";

  const [searchValue, setSearchValue] = useState(activeQuery);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);

  // Voice search hook
  const handleVoiceResult = useCallback((transcript: string) => {
    setSearchValue(transcript);
    setSearchDropdownOpen(true);
  }, []);
  
  const { isListening, isSupported: voiceSupported, toggleListening } = useVoiceSearch(handleVoiceResult);

  // Typing animation for search placeholder
  const placeholderTexts = useMemo(() => [
    "Search for cosmetics...",
    "Find jewelry...",
    "Discover socks...",
    "Browse accessories...",
    "Explore henna...",
    "Search products...",
  ], []);
  
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    if (searchFocused || searchValue) return; // Pause animation when focused or has value
    
    const currentText = placeholderTexts[placeholderIndex];
    let charIndex = isTyping ? displayedPlaceholder.length : currentText.length;
    
    const typeSpeed = 80;
    const deleteSpeed = 40;
    const pauseBeforeDelete = 2000;
    const pauseBeforeType = 300;

    if (isTyping) {
      if (charIndex < currentText.length) {
        const timer = setTimeout(() => {
          setDisplayedPlaceholder(currentText.slice(0, charIndex + 1));
        }, typeSpeed);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          setIsTyping(false);
        }, pauseBeforeDelete);
        return () => clearTimeout(timer);
      }
    } else {
      if (charIndex > 0) {
        const timer = setTimeout(() => {
          setDisplayedPlaceholder(currentText.slice(0, charIndex - 1));
        }, deleteSpeed);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          setPlaceholderIndex((prev) => (prev + 1) % placeholderTexts.length);
          setIsTyping(true);
        }, pauseBeforeType);
        return () => clearTimeout(timer);
      }
    }
  }, [displayedPlaceholder, isTyping, placeholderIndex, placeholderTexts, searchFocused, searchValue]);

  // Reset animation when focus/value changes
  useEffect(() => {
    if (!searchFocused && !searchValue) {
      setDisplayedPlaceholder("");
      setIsTyping(true);
    }
  }, [searchFocused, searchValue]);

  // Add blinking cursor effect to the animated placeholder
  const showCursor = !searchFocused && !searchValue;
  const animatedPlaceholder = searchFocused || searchValue ? "Search products..." : (displayedPlaceholder || "Search");

  useEffect(() => {
    setSearchValue(activeQuery);
  }, [activeQuery]);

  const runSearch = (
    nextValue: string,
    opts?: {
      closeMobile?: boolean;
      replace?: boolean;
    },
  ) => {
    const q = nextValue.trim();
    const nextParams = new URLSearchParams();

    if (isProductsPage && activeCategory) nextParams.set("category", activeCategory);
    if (q) nextParams.set("q", q);

    const search = nextParams.toString();
    navigate(search ? `/products?${search}` : "/products", { replace: opts?.replace });
    if (opts?.closeMobile !== false) setMobileSearchOpen(false);
  };

  const scheduleLiveSearchIfOnProducts = (nextValue: string) => {
    if (!isProductsPage) return;

    if (debounceTimerRef.current != null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    debounceTimerRef.current = window.setTimeout(() => {
      runSearch(nextValue, { closeMobile: false, replace: true });
    }, 250);
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current != null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!(searchFocused || mobileSearchOpen)) return;
    if (!searchValue.trim()) return;

    const unsub = onSnapshot(
      collection(db, "products"),
      (snap) => {
        const next = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as ProductDoc) }))
          .filter((p) => isPublished((p as any).published))
          .map((p) => ({
            id: p.id,
            name: p.name,
            price: Number((p as any).price ?? 0),
            imageUrls: Array.isArray((p as any).imageUrls) ? (p as any).imageUrls : [],
            description: String((p as any).description ?? ""),
            brand: (p as any).brand ? String((p as any).brand) : undefined,
            sku: (p as any).sku ? String((p as any).sku) : undefined,
            tags: Array.isArray((p as any).tags) ? (p as any).tags : undefined,
            gender: (p as any).gender as "male" | "female" | "unisex" | undefined,
            published: Boolean((p as any).published),
          }))
          .slice(0, 500);

        setSearchCatalog(next);
      },
      () => {
        setSearchCatalog([]);
      },
    );

    return () => unsub();
  }, [mobileSearchOpen, searchFocused, searchValue]);

  const searchSuggestions = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return [];

    const terms = q.split(/\s+/).filter(Boolean);
    if (!terms.length) return [];

    const matches = searchCatalog.filter((p) => {
      const haystack = [
        p.name,
        p.description,
        p.brand,
        p.sku,
        p.gender,
        ...(p.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return terms.every((t) => haystack.includes(t));
    });

    // Prefer starts-with name matches first.
    matches.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(terms[0]) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(terms[0]) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.name.localeCompare(b.name);
    });

    return matches.slice(0, 6);
  }, [searchCatalog, searchValue]);

  const isNavItemActive = (item: NavItem) => {
    if (!isProductsPage) return false;
    if (!item.category) return !activeCategory;
    return activeCategory === item.category;
  };

  // Check if any interactive element is open (prevent navbar hide)
  const isInteractiveOpen = searchFocused || searchDropdownOpen || mobileSearchOpen || mobileCategoriesOpen || desktopCategoryDropdownOpen;

  useEffect(() => {
    const onScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Determine if scrolled past threshold for styling
      setIsScrolled(currentScrollY > 8);
      
      // Hide/show based on scroll direction (but not when interactive elements are open)
      if (!isInteractiveOpen && currentScrollY > lastScrollY.current && currentScrollY > 100) {
        // Scrolling down & past threshold - hide
        setIsHidden(true);
      } else {
        // Scrolling up or interactive open - show
        setIsHidden(false);
      }
      
      lastScrollY.current = currentScrollY;
    };
    
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isInteractiveOpen]);

  // Use categories + category images from Firestore when present.
  // Falls back to local images for the default categories.
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "categories"),
      (snap) => {
        const next: Record<string, string> = {};
        const nextDocs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as CategoryDoc) }));

        nextDocs.forEach((data) => {
          const canonical = getCategorySlug(String(data.name ?? ""), String(data.slug ?? ""));
          const imageUrl = String(data.imageUrl ?? "").trim();
          if (canonical && imageUrl) next[canonical] = imageUrl;
        });

        setCategories(nextDocs);
        setCategoryImagesBySlug(next);
      },
      () => {
        // Keep fallbacks only on error.
        setCategories([]);
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

  const navItems: NavItem[] = useMemo(() => {
    const uiCategories = buildUiCategoriesFromDocs(categories).map((c) => ({
      label: c.title,
      to: c.href,
      category: c.slug,
    }));

    return [{ label: "All Products", to: "/products" }, ...uiCategories];
  }, [categories]);

  const activeCategoryLabel = useMemo(() => {
    if (!isProductsPage) return null;
    if (!activeCategory) return "All Products";
    return navItems.find((i) => i.category === activeCategory)?.label ?? null;
  }, [activeCategory, isProductsPage, navItems]);

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
        isScrolled ? "bg-background/80 border-border/70" : "bg-background/60 border-border/50",
        isHidden ? "-translate-y-full shadow-none" : "translate-y-0",
        !isHidden && isScrolled && "shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.15)] dark:shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.25)]"
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
                className="h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
                loading="eager"
                decoding="async"
              />
              <span className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-primary/0 transition-all duration-300 group-hover:ring-primary/30 group-hover:scale-110" />
            </span>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent transition-all duration-300 group-hover:tracking-wide group-hover:drop-shadow-[0_0_8px_hsl(var(--primary)/0.3)] hidden sm:block">
              TrendMix
            </h1>
          </Link>
        </div>

        {/* Desktop Search - hidden on mobile */}
        <div className="flex-1 flex items-center justify-center">
          <div className={cn(
            "relative hidden md:block w-full max-w-[400px] lg:max-w-[520px] group/search transition-all duration-300",
            searchFocused && "max-w-[440px] lg:max-w-[560px]"
          )}>
            {/* Animated glow background */}
            <div className={cn(
              "absolute -inset-1 rounded-full bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 opacity-0 blur-md transition-all duration-500",
              searchFocused && "opacity-100 animate-pulse"
            )} />
            
            {/* Search icon with animation */}
            <Search className={cn(
              "absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-all duration-300 z-10",
              searchFocused && "text-primary scale-110"
            )} />
            
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runSearch(searchValue, { closeMobile: false });
              }}
            >
              <Input
                value={searchValue}
                onChange={(e) => {
                  const next = e.target.value;
                  setSearchValue(next);
                  setSearchDropdownOpen(true);
                  scheduleLiveSearchIfOnProducts(next);
                }}
                onFocus={() => {
                  setSearchFocused(true);
                  setSearchDropdownOpen(true);
                }}
                onBlur={() => {
                  setSearchFocused(false);
                  window.setTimeout(() => setSearchDropdownOpen(false), 150);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setSearchValue("");
                    if (activeQuery) runSearch("", { closeMobile: false, replace: true });
                  }
                }}
                placeholder={animatedPlaceholder + (showCursor ? "|" : "")}
                className={cn(
                  "relative h-10 lg:h-11 w-full rounded-full border-2 bg-background/80 pl-10 pr-24 text-sm transition-all duration-300",
                  "border-border/40 hover:border-border/60 hover:bg-background/90",
                  "focus-visible:ring-0 focus-visible:border-primary/50 focus-visible:bg-background focus-visible:shadow-[0_0_20px_hsl(var(--primary)/0.15),inset_0_1px_2px_hsl(var(--primary)/0.05)]",
                  "placeholder:text-muted-foreground/60 placeholder:transition-all placeholder:duration-300",
                  searchFocused && "placeholder:translate-x-1 placeholder:opacity-60",
                  showCursor && "placeholder:animate-[blink-cursor_1s_step-end_infinite]"
                )}
                aria-label="Search products"
              />

              {/* Voice search button */}
              {voiceSupported && (
                <div className={cn(
                  "absolute top-1/2 -translate-y-1/2 transition-all duration-300",
                  searchValue.trim() ? "right-[88px]" : "right-[72px]"
                )}>
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={cn(
                      "h-7 w-7 rounded-full grid place-items-center transition-all duration-300",
                      isListening 
                        ? "bg-destructive/10 text-destructive animate-pulse" 
                        : "text-muted-foreground hover:text-primary hover:bg-accent/50 hover:scale-110 active:scale-90"
                    )}
                    aria-label={isListening ? "Stop voice search" : "Start voice search"}
                  >
                    {isListening ? (
                      <MicOff className="h-3.5 w-3.5" />
                    ) : (
                      <Mic className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              )}

              {/* Clear button with enhanced animation */}
              <div className={cn(
                "absolute top-1/2 -translate-y-1/2 transition-all duration-300",
                voiceSupported ? "right-[60px]" : "right-14",
                searchValue.trim() ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
              )}>
                <button
                  type="button"
                  className="h-7 w-7 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-300 hover:rotate-90 hover:scale-110 active:scale-90"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearchValue("");
                    if (isProductsPage && activeQuery) runSearch("", { closeMobile: false, replace: true });
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Search button with gradient */}
              <button
                type="submit"
                className={cn(
                  "absolute right-1.5 top-1/2 -translate-y-1/2 h-8 px-3 rounded-full text-xs font-semibold transition-all duration-300",
                  "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground",
                  "hover:shadow-[0_4px_16px_hsl(var(--primary)/0.4)] hover:scale-[1.02] hover:-translate-y-[51%]",
                  "active:scale-95 active:shadow-none",
                  searchFocused && "from-primary via-primary/95 to-secondary/80"
                )}
                aria-label="Search"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
            </form>

            {/* Enhanced suggestions dropdown */}
            {searchDropdownOpen && searchValue.trim() ? (
              <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 rounded-2xl border-2 border-border/50 bg-popover/95 backdrop-blur-xl shadow-[0_8px_32px_hsl(var(--foreground)/0.1)] overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-200">
                {/* Decorative top gradient line */}
                <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                
                <div className="max-h-[360px] overflow-y-auto">
                  {searchSuggestions.length ? (
                    <div className="py-2">
                      {searchSuggestions.map((p, index) => {
                        const img = p.imageUrls?.[0];
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-200 hover:bg-accent/60 group/item"
                            style={{ animationDelay: `${index * 30}ms` }}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setSearchDropdownOpen(false);
                              setMobileSearchOpen(false);
                              navigate(`/product/${p.id}`);
                            }}
                          >
                            {img ? (
                              <div className="relative h-12 w-12 rounded-lg overflow-hidden border border-border/50 bg-muted flex-shrink-0">
                                <img
                                  src={img}
                                  alt=""
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover/item:scale-110"
                                  loading="eager"
                                  decoding="async"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                                {/* Hover overlay */}
                                <div className="absolute inset-0 bg-primary/0 transition-colors duration-300 group-hover/item:bg-primary/10" />
                              </div>
                            ) : (
                              <span className="h-12 w-12 rounded-lg border border-border/50 bg-muted flex-shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate transition-colors duration-200 group-hover/item:text-primary">{p.name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5 font-medium">{formatCurrency(Number(p.price ?? 0))}</div>
                            </div>
                            {/* Arrow indicator */}
                            <div className="opacity-0 -translate-x-2 transition-all duration-200 group-hover/item:opacity-100 group-hover/item:translate-x-0">
                              <ChevronDown className="h-4 w-4 -rotate-90 text-primary" />
                            </div>
                          </button>
                        );
                      })}
                      
                      <div className="mx-4 my-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                      
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-accent/50 transition-all duration-200 group/all"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => runSearch(searchValue, { closeMobile: false })}
                      >
                        <span className="text-sm font-semibold text-primary transition-transform duration-200 group-hover/all:translate-x-1">View all results</span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-mono">↵</span>
                      </button>
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-center">
                      <Search className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No products found</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Try a different search term</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 transition-all duration-300 hover:bg-accent/50 hover:scale-105 active:scale-95"
            aria-label={mobileSearchOpen ? "Close search" : "Open search"}
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
          >
            {mobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </Button>

          {/* Categories: Dropdown (desktop) + Sheet (mobile) */}
          <div className="hidden lg:block">
            <DropdownMenu open={desktopCategoryDropdownOpen} onOpenChange={setDesktopCategoryDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 lg:h-10 rounded-full border-border/50 bg-background/40 px-3 lg:px-4 font-medium transition-all duration-300 hover:bg-accent/40 hover:scale-[1.02] hover:shadow-[0_0_12px_hsl(var(--primary)/0.15)] active:scale-[0.98]"
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
                  const item = navItems[0];
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
                  {navItems.slice(1).map((item) => {
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
                className="lg:hidden h-9 w-9 sm:h-10 sm:w-10 rounded-full border-border/50 bg-background/40 transition-all duration-300 hover:bg-accent/40 hover:scale-105 hover:shadow-[0_0_12px_hsl(var(--primary)/0.15)] active:scale-95"
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
                      className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-accent/30 transition-all duration-300 hover:bg-accent hover:scale-105 hover:shadow-md active:scale-95"
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
                      className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-accent/30 transition-all duration-300 hover:bg-accent hover:scale-105 hover:shadow-md active:scale-95"
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
                      className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-accent/30 transition-all duration-300 hover:bg-accent hover:scale-105 hover:shadow-md active:scale-95"
                    >
                      <User className="h-5 w-5" />
                      <span className="text-xs font-medium">Account</span>
                    </Link>
                  </div>
                </div>

                {/* Categories */}
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">Categories</h3>
                <nav className="flex flex-col gap-1">
                  {navItems.map((item) => {
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
                  <Link to="/about" onClick={() => setMobileCategoriesOpen(false)} className="transition-all duration-200 hover:text-primary hover:translate-x-0.5">About</Link>
                  <Link to="/contact" onClick={() => setMobileCategoriesOpen(false)} className="transition-all duration-200 hover:text-primary hover:translate-x-0.5">Contact</Link>
                  <Link to="/faq" onClick={() => setMobileCategoriesOpen(false)} className="transition-all duration-200 hover:text-primary hover:translate-x-0.5">FAQ</Link>
                  <Link to="/shipping" onClick={() => setMobileCategoriesOpen(false)} className="transition-all duration-200 hover:text-primary hover:translate-x-0.5">Shipping</Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 transition-all duration-300 hover:bg-accent/50 hover:scale-110 hover:text-primary active:scale-95 hidden sm:inline-flex group"
            aria-label="Cart"
            asChild
          >
            <Link to="/cart">
              <ShoppingCart className="h-5 w-5 transition-transform duration-300 group-hover:rotate-[-8deg]" />
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
            className="relative h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 transition-all duration-300 hover:bg-accent/50 hover:scale-110 hover:text-primary active:scale-95 hidden sm:inline-flex group"
            aria-label="Wishlist"
            asChild
          >
            <Link to="/wishlist">
              <Heart className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
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
            className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 transition-all duration-300 hover:bg-accent/50 hover:scale-110 hover:text-primary active:scale-95 hidden sm:inline-flex group"
            aria-label="Profile"
            asChild
          >
            <Link to="/account">
              <User className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Mobile Search Bar - slides down when open */}
      <div
        className={cn(
          "md:hidden overflow-hidden transition-all duration-300 ease-in-out",
          mobileSearchOpen ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        {/* Decorative gradient line */}
        <div className={cn(
          "h-px w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent transition-opacity duration-300",
          mobileSearchOpen ? "opacity-100" : "opacity-0"
        )} />
        
        <div className="container px-3 sm:px-4 py-3">
          <div className="relative group/mobile-search">
            {/* Animated glow background */}
            <div className={cn(
              "absolute -inset-1 rounded-full bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 opacity-0 blur-md transition-all duration-500",
              searchFocused && "opacity-100 animate-pulse"
            )} />
            
            {/* Search icon with animation */}
            <Search className={cn(
              "absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-all duration-300 z-10",
              searchFocused && "text-primary scale-110"
            )} />
            
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runSearch(searchValue);
              }}
            >
              <Input
                value={searchValue}
                onChange={(e) => {
                  const next = e.target.value;
                  setSearchValue(next);
                  setSearchDropdownOpen(true);
                  scheduleLiveSearchIfOnProducts(next);
                }}
                onFocus={() => {
                  setSearchFocused(true);
                  setSearchDropdownOpen(true);
                }}
                onBlur={() => {
                  setSearchFocused(false);
                  window.setTimeout(() => setSearchDropdownOpen(false), 150);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setSearchValue("");
                    if (activeQuery) runSearch("", { replace: true });
                  }
                }}
                placeholder={animatedPlaceholder + (showCursor ? "|" : "")}
                className={cn(
                  "relative h-11 w-full rounded-full border-2 bg-background/90 pl-10 pr-24 text-sm transition-all duration-300",
                  "border-border/40 hover:border-border/60",
                  "focus-visible:ring-0 focus-visible:border-primary/50 focus-visible:bg-background focus-visible:shadow-[0_0_20px_hsl(var(--primary)/0.15),inset_0_1px_2px_hsl(var(--primary)/0.05)]",
                  "placeholder:text-muted-foreground/60",
                  showCursor && "placeholder:animate-blink-cursor"
                )}
                autoFocus={mobileSearchOpen}
                aria-label="Search products"
              />

              {/* Voice search button */}
              {voiceSupported && (
                <div className={cn(
                  "absolute top-1/2 -translate-y-1/2 transition-all duration-300",
                  searchValue.trim() ? "right-[88px]" : "right-[72px]"
                )}>
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={cn(
                      "h-7 w-7 rounded-full grid place-items-center transition-all duration-300",
                      isListening 
                        ? "bg-destructive/10 text-destructive animate-pulse" 
                        : "text-muted-foreground hover:text-primary hover:bg-accent/50 hover:scale-110 active:scale-90"
                    )}
                    aria-label={isListening ? "Stop voice search" : "Start voice search"}
                  >
                    {isListening ? (
                      <MicOff className="h-3.5 w-3.5" />
                    ) : (
                      <Mic className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              )}

              {/* Clear button with animation */}
              <div className={cn(
                "absolute top-1/2 -translate-y-1/2 transition-all duration-300",
                voiceSupported ? "right-[60px]" : "right-14",
                searchValue.trim() ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
              )}>
                <button
                  type="button"
                  className="h-7 w-7 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-300 hover:rotate-90 hover:scale-110 active:scale-90"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearchValue("");
                    if (isProductsPage && activeQuery) runSearch("", { replace: true, closeMobile: false });
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Search button with gradient */}
              <button
                type="submit"
                className={cn(
                  "absolute right-1.5 top-1/2 -translate-y-1/2 h-8 px-3 rounded-full text-xs font-semibold transition-all duration-300",
                  "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground",
                  "hover:shadow-[0_4px_16px_hsl(var(--primary)/0.4)] active:scale-95",
                  searchFocused && "from-primary via-primary/95 to-secondary/80"
                )}
                aria-label="Search"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
            </form>

            {/* Enhanced mobile suggestions dropdown */}
            {searchDropdownOpen && mobileSearchOpen && searchValue.trim() ? (
              <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 rounded-2xl border-2 border-border/50 bg-popover/95 backdrop-blur-xl shadow-[0_8px_32px_hsl(var(--foreground)/0.1)] overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-200">
                {/* Decorative top gradient line */}
                <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                
                <div className="max-h-[280px] overflow-y-auto">
                  {searchSuggestions.length ? (
                    <div className="py-2">
                      {searchSuggestions.map((p, index) => {
                        const img = p.imageUrls?.[0];
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-200 hover:bg-accent/60 active:bg-accent group/item"
                            style={{ animationDelay: `${index * 30}ms` }}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setSearchDropdownOpen(false);
                              setMobileSearchOpen(false);
                              navigate(`/product/${p.id}`);
                            }}
                          >
                            {img ? (
                              <div className="relative h-11 w-11 rounded-lg overflow-hidden border border-border/50 bg-muted flex-shrink-0">
                                <img
                                  src={img}
                                  alt=""
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover/item:scale-110"
                                  loading="eager"
                                  decoding="async"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                                <div className="absolute inset-0 bg-primary/0 transition-colors duration-300 group-hover/item:bg-primary/10" />
                              </div>
                            ) : (
                              <span className="h-11 w-11 rounded-lg border border-border/50 bg-muted flex-shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate transition-colors duration-200 group-hover/item:text-primary">{p.name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5 font-medium">{formatCurrency(Number(p.price ?? 0))}</div>
                            </div>
                            <ChevronDown className="h-4 w-4 -rotate-90 text-muted-foreground/50 transition-all duration-200 group-hover/item:text-primary group-hover/item:translate-x-0.5" />
                          </button>
                        );
                      })}
                      
                      <div className="mx-4 my-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                      
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-accent/50 active:bg-accent transition-all duration-200 group/all"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => runSearch(searchValue)}
                      >
                        <span className="text-sm font-semibold text-primary">View all results</span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">Go</span>
                      </button>
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-center">
                      <Search className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No products found</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Try a different search term</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
