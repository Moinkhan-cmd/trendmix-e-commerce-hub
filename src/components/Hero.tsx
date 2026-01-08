import { useEffect, useMemo, useState, useRef } from "react";
import { doc, getDocFromServer, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PersonalProfileDoc, SocialLink } from "@/lib/models";
import { buildInstagramUrl, buildXUrl, inferPlatformFromUrl, normalizeUrl } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { ArrowRight, Github, Instagram, Linkedin, Link as LinkIcon, Sparkles, Twitter, Star, Zap, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import heroBanner from "@/assets/hero-banner.jpg";
import { Card3D, FloatingElement } from "./Card3D";

type LinkItem = { href: string; label: string; platform: string };

function iconFor(platform: string) {
  switch (platform) {
    case "instagram": return Instagram;
    case "x":
    case "twitter": return Twitter;
    case "linkedin": return Linkedin;
    case "github": return Github;
    default: return LinkIcon;
  }
}

function linkItemsFromProfile(p: PersonalProfileDoc): LinkItem[] {
  const items: LinkItem[] = [];
  if (p.instagramId?.trim()) {
    items.push({ href: buildInstagramUrl(p.instagramId), label: "Instagram", platform: "instagram" });
  }
  if (p.xId?.trim()) {
    items.push({ href: buildXUrl(p.xId), label: "X", platform: "x" });
  }
  const links = Array.isArray(p.socialLinks) ? p.socialLinks : [];
  for (const l of links) {
    const raw = (l as SocialLink).url ?? "";
    const href = normalizeUrl(raw);
    if (!href) continue;
    const platform = (l as any).platform || inferPlatformFromUrl(href) || "website";
    const label = (l as any).label || platform;
    items.push({ href, label, platform });
  }
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.href) ? false : (seen.add(i.href), true)));
}

const Hero = () => {
  const [profile, setProfile] = useState<PersonalProfileDoc | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const ref = doc(db, "settings", "personalProfile");

    let unsub: undefined | (() => void);
    let cancelled = false;

    (async () => {
      try {
        const snap = await getDocFromServer(ref);
        if (cancelled) return;

        if (!snap.exists()) {
          setProfile(null);
        } else {
          setProfile(snap.data() as PersonalProfileDoc);
        }

        unsub = onSnapshot(
          ref,
          { includeMetadataChanges: true },
          (nextSnap) => {
            if (nextSnap.metadata.fromCache) return;
            if (!nextSnap.exists()) {
              setProfile(null);
              return;
            }
            setProfile(nextSnap.data() as PersonalProfileDoc);
          },
          (err) => {
            console.warn("Failed to subscribe to personal profile:", err);
          }
        );
      } catch (err) {
        if (cancelled) return;
        console.warn("Failed to load personal profile from server:", err);
        setProfile(null);
      }
    })();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
      setMousePosition({
        x: ((e.clientX - rect.left) / rect.width - 0.5) * 20,
        y: ((e.clientY - rect.top) / rect.height - 0.5) * 20,
      });
    };
    
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const featured = profile?.featured;
  const showFeatured = Boolean(featured?.enabled && featured?.visible);
  const socialItems = useMemo(() => (profile ? linkItemsFromProfile(profile) : []), [profile]);

  return (
    <section ref={heroRef} className="relative w-full overflow-hidden bg-gradient-to-br from-primary/5 via-secondary/5 to-background perspective-1500">
      {/* Animated 3D Background Elements */}
      <div aria-hidden className="pointer-events-none absolute inset-0 preserve-3d">
        {/* Primary glow orb */}
        <div 
          className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl morph-3d"
          style={{ transform: `translateX(${mousePosition.x}px) translateY(${mousePosition.y}px)` }}
        />
        {/* Secondary glow orb */}
        <div 
          className="absolute -bottom-28 -right-28 h-[500px] w-[500px] rounded-full bg-secondary/15 blur-3xl"
          style={{ 
            transform: `translateX(${-mousePosition.x * 0.5}px) translateY(${-mousePosition.y * 0.5}px)`,
            animation: "morph3d 12s ease-in-out infinite reverse"
          }}
        />
        {/* Floating 3D shapes */}
        <FloatingElement className="absolute top-20 right-1/4" delay={0} duration={8}>
          <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/30 to-secondary/30 rotate-45 blur-sm" />
        </FloatingElement>
        <FloatingElement className="absolute bottom-32 left-1/4" delay={2} duration={7}>
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-secondary/40 to-primary/40 blur-sm" />
        </FloatingElement>
        <FloatingElement className="absolute top-1/2 right-10" delay={1} duration={9}>
          <Star className="h-6 w-6 text-primary/30" />
        </FloatingElement>
        <FloatingElement className="absolute top-32 left-10" delay={3} duration={6}>
          <Zap className="h-5 w-5 text-secondary/30" />
        </FloatingElement>
      </div>

      <div className="container relative py-10 md:py-16 lg:py-20 preserve-3d">
        {/* Featured Profile Block */}
        {showFeatured && (
          <div className="mb-10 flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left reveal-up">
            {profile?.photoUrl && (
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary to-secondary blur-md animate-pulse" />
                <img
                  src={profile.photoUrl}
                  alt="Featured profile"
                  className="relative h-20 w-20 rounded-full border-4 border-background object-cover shadow-lg"
                />
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-xl font-semibold sm:text-2xl text-3d">{featured?.title || "Featured"}</h2>
              {featured?.tagline && (
                <p className="mt-1 text-muted-foreground">{featured.tagline}</p>
              )}
            </div>
            {socialItems.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 sm:justify-end">
                {socialItems.map((i, idx) => {
                  const Icon = iconFor(i.platform);
                  return (
                    <a
                      key={i.href}
                      href={i.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={`inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-sm text-muted-foreground backdrop-blur hover:text-foreground hover:bg-muted/60 transition-all hover-lift stagger-${idx + 1}`}
                      style={{ animationFillMode: "backwards" }}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="capitalize">{i.label}</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-10">
          <div className="flex flex-col justify-center space-y-7 text-center lg:text-left preserve-3d">
            {/* Badge with glow */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary backdrop-blur self-center lg:self-start shine-effect glow-pulse reveal-up stagger-1" style={{ animationFillMode: "backwards" }}>
              <Sparkles className="h-4 w-4 animate-pulse" />
              <span>New Arrivals Daily</span>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl reveal-up stagger-2" style={{ animationFillMode: "backwards" }}>
                <span className="text-3d inline-block hover:scale-105 transition-transform cursor-default">Discover Your</span>
                <br />
                <span className="bg-gradient-to-r from-primary via-pink-500 to-secondary bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient inline-block">
                  Perfect Style
                </span>
              </h1>

              <p className="mx-auto max-w-[42rem] text-muted-foreground text-lg md:text-xl lg:mx-0 reveal-up stagger-3" style={{ animationFillMode: "backwards" }}>
                Shop the latest trends in beauty, jewelry, and fashion accessories.
                Curated collections that blend style with affordability.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 self-center lg:self-start reveal-up stagger-4" style={{ animationFillMode: "backwards" }}>
              <Button asChild size="lg" className="group btn-3d shine-effect relative overflow-hidden">
                <Link to="/products">
                  <span className="relative z-10 flex items-center">
                    <ShoppingBag className="mr-2 h-5 w-5" />
                    Shop Now
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="hover-lift ripple-3d">
                <Link to="/#categories">View Collections</Link>
              </Button>
            </div>

            {/* Stats with 3D cards */}
            <div className="self-center lg:self-start reveal-up stagger-5" style={{ animationFillMode: "backwards" }}>
              <div className="inline-flex items-center gap-6 sm:gap-8 rounded-2xl border border-border glass-card px-5 py-4 shadow-3d-elevated">
                <div className="text-center group cursor-default">
                  <p className="text-2xl font-bold leading-none group-hover:text-primary transition-colors group-hover:scale-110 inline-block transition-transform">2000+</p>
                  <p className="mt-1 text-sm text-muted-foreground">Products</p>
                </div>
                <div className="h-10 w-px bg-border/50" />
                <div className="text-center group cursor-default">
                  <p className="text-2xl font-bold leading-none group-hover:text-primary transition-colors group-hover:scale-110 inline-block transition-transform">50k+</p>
                  <p className="mt-1 text-sm text-muted-foreground">Happy Customers</p>
                </div>
                <div className="h-10 w-px bg-border/50" />
                <div className="text-center group cursor-default">
                  <p className="text-2xl font-bold leading-none group-hover:text-secondary transition-colors group-hover:scale-110 inline-block transition-transform">4.8★</p>
                  <p className="mt-1 text-sm text-muted-foreground">Average Rating</p>
                </div>
              </div>
            </div>
          </div>

          {/* Hero Image with 3D Effect */}
          <div className="relative flex items-center justify-center lg:justify-end perspective-1000">
            <Card3D 
              className="w-full max-w-xl"
              rotateIntensity={10}
              scaleOnHover={1.03}
              glareMaxOpacity={0.15}
            >
              <div className="relative">
                {/* Glow backdrop */}
                <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-r from-primary/30 via-pink-500/20 to-secondary/30 blur-2xl opacity-60 animate-pulse" />
                
                {/* Main image container */}
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border/50 bg-muted shadow-3d">
                  <img
                    src={heroBanner}
                    alt="TrendMix featured products showcase"
                    className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                  
                  {/* Overlay gradient */}
                  <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
                  
                  {/* Floating badges */}
                  <FloatingElement 
                    className="absolute top-4 right-4" 
                    delay={0.5} 
                    duration={5}
                  >
                    <div className="flex items-center gap-2 rounded-full bg-background/90 backdrop-blur px-3 py-1.5 text-sm font-medium shadow-lg border border-border">
                      <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      New In
                    </div>
                  </FloatingElement>
                  
                  <FloatingElement 
                    className="absolute bottom-4 left-4" 
                    delay={1} 
                    duration={6}
                  >
                    <div className="flex items-center gap-2 rounded-full bg-primary/90 backdrop-blur px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-lg">
                      <Zap className="h-4 w-4" />
                      Trending
                    </div>
                  </FloatingElement>
                </div>

                {/* Decorative 3D elements */}
                <div className="absolute -top-6 -right-6 h-24 w-24 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 blur-xl float-3d" />
                <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-gradient-to-br from-secondary/20 to-primary/20 blur-xl float-3d-delayed" />
              </div>
            </Card3D>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />

      <style>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </section>
  );
};

export default Hero;
