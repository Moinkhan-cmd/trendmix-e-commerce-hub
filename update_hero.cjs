const fs = require('fs');
const content = `import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PersonalProfileDoc, SocialLink } from "@/lib/models";
import { buildInstagramUrl, buildXUrl, inferPlatformFromUrl, normalizeUrl } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { ArrowRight, Github, Instagram, Linkedin, Link as LinkIcon, Sparkles, Twitter } from "lucide-react";
import { Link } from "react-router-dom";
import heroBanner from "@/assets/hero-banner.jpg";

type LinkItem = { href: string; label: string; platform: string };

function iconFor(platform: string) {
  switch (platform) {
    case "instagram":
      return Instagram;
    case "x":
    case "twitter":
      return Twitter;
    case "linkedin":
      return Linkedin;
    case "github":
      return Github;
    default:
      return LinkIcon;
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
    if (href === "") continue;
    const platform = (l as any).platform || inferPlatformFromUrl(href) || "website";
    const label = (l as any).label || platform;
    items.push({ href, label, platform });
  }
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.href) ? false : (seen.add(i.href), true)));
}

const Hero = () => {
  const [profile, setProfile] = useState<PersonalProfileDoc | null>(null);

  useEffect(() => {
    const ref = doc(db, "settings", "personalProfile");
    return onSnapshot(ref, (snap) => {
      if (snap.exists() === false) {
        setProfile(null);
        return;
      }
      setProfile(snap.data() as PersonalProfileDoc);
    });
  }, []);

  const featured = profile?.featured;
  const showFeatured = Boolean(featured?.enabled && featured?.visible);
  const socialItems = useMemo(() => (profile ? linkItemsFromProfile(profile) : []), [profile]);

  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-br from-primary/5 via-secondary/5 to-background">
      {/* 3D Background Effects */}
      <div aria-hidden className="pointer-events-none absolute inset-0 preserve-3d perspective-1500">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl float-3d" />
        <div className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-secondary/15 blur-3xl float-3d-delayed" />
        
        {/* 3D Floating Shapes */}
        <div className="absolute top-1/4 right-1/4 w-20 h-20 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 backdrop-blur-sm border border-white/10 rotate-12" style={{ animation: "float3d 8s ease-in-out infinite" }} />
        <div className="absolute top-1/3 left-20 w-16 h-16 rounded-full bg-gradient-to-tr from-secondary/20 to-primary/20 backdrop-blur-sm border border-white/10" style={{ animation: "float3d 10s ease-in-out infinite", animationDelay: "2s" }} />
        <div className="absolute bottom-1/4 right-1/3 w-12 h-12 rounded-lg bg-gradient-to-bl from-primary/15 to-transparent backdrop-blur-sm border border-white/10" style={{ animation: "float3d 7s ease-in-out infinite", animationDelay: "4s" }} />
        
        {/* Animated Rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-primary/5 rotate-3d opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-secondary/5 opacity-20" style={{ animation: "rotate3d 25s linear infinite reverse" }} />
      </div>

      <div className="container relative py-16 md:py-24 lg:py-28">
        {showFeatured && (
          <div className="mb-10 flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
            {profile?.photoUrl && (
              <img src={profile.photoUrl} alt="Featured profile" className="h-20 w-20 rounded-full border-4 border-primary/20 object-cover shadow-lg glow-pulse" />
            )}
            <div className="flex-1">
              <h2 className="text-xl font-semibold sm:text-2xl">{featured?.title || "Featured"}</h2>
              {featured?.tagline && <p className="mt-1 text-muted-foreground">{featured.tagline}</p>}
            </div>
            {socialItems.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 sm:justify-end">
                {socialItems.map((i) => {
                  const Icon = iconFor(i.platform);
                  return (
                    <a key={i.href} href={i.href} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-sm text-muted-foreground backdrop-blur hover:text-foreground hover:bg-muted/60 transition-all hover:scale-105">
                      <Icon className="h-4 w-4" />
                      <span className="capitalize">{i.label}</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="flex flex-col justify-center space-y-7 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-sm font-medium text-primary backdrop-blur self-center lg:self-start shine-effect">
              <Sparkles className="h-4 w-4" />
              <span>New Arrivals Daily</span>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
                Discover Your
                <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"> Perfect Style</span>
              </h1>
              <p className="mx-auto max-w-[42rem] text-muted-foreground text-lg md:text-xl lg:mx-0">
                Shop the latest trends in beauty, jewelry, and fashion accessories. Curated collections that blend style with affordability.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 self-center lg:self-start">
              <Button asChild size="lg" variant="hero" className="group shine-effect">
                <Link to="/products">
                  Shop Now
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="hover:scale-105 transition-transform">
                <Link to="/#categories">View Collections</Link>
              </Button>
            </div>

            <div className="self-center lg:self-start">
              <div className="inline-flex items-center gap-8 rounded-xl border border-border bg-background/60 px-5 py-4 backdrop-blur glass-3d shadow-3d">
                <div className="text-center">
                  <p className="text-2xl font-bold leading-none">2000+</p>
                  <p className="mt-1 text-sm text-muted-foreground">Products</p>
                </div>
                <div className="h-10 w-px bg-border" />
                <div className="text-center">
                  <p className="text-2xl font-bold leading-none">50k+</p>
                  <p className="mt-1 text-sm text-muted-foreground">Happy Customers</p>
                </div>
                <div className="h-10 w-px bg-border" />
                <div className="text-center">
                  <p className="text-2xl font-bold leading-none">4.8★</p>
                  <p className="mt-1 text-sm text-muted-foreground">Average Rating</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex items-center justify-center lg:justify-end">
            <div className="relative w-full max-w-xl tilt-3d">
              <div className="absolute -inset-6 rounded-[2.25rem] bg-gradient-to-r from-primary/20 to-secondary/20 blur-2xl opacity-60 glow-pulse" />
              <div className="relative overflow-hidden rounded-2xl border border-border bg-muted shadow-3d">
                <img src={heroBanner} alt="TrendMix featured products showcase" className="h-auto w-full object-cover transition-transform duration-700 hover:scale-105" />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
`;
fs.writeFileSync('src/components/Hero.tsx', content);
console.log('Hero.tsx updated successfully');
