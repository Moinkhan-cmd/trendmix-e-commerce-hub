import { useEffect, useMemo, useState } from "react";
import { doc, getDocFromServer, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PersonalProfileDoc, SocialLink } from "@/lib/models";
import { buildInstagramUrl, buildXUrl, inferPlatformFromUrl, normalizeUrl } from "@/lib/profile";
import { Card } from "@/components/ui/card";
import { Github, Instagram, Linkedin, Link as LinkIcon, Twitter } from "lucide-react";

type LinkItem = {
  href: string;
  label: string;
  platform: string;
};

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
    if (!href) continue;
    const platform = (l as any).platform || inferPlatformFromUrl(href) || "website";
    const label = (l as any).label || platform;
    items.push({ href, label, platform });
  }

  // De-dup by href
  const seen = new Set<string>();
  return items.filter((i) => {
    if (seen.has(i.href)) return false;
    seen.add(i.href);
    return true;
  });
}

export default function FeaturedProfileBanner() {
  const [profile, setProfile] = useState<PersonalProfileDoc | null>(null);

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
          (nextSnap) => {
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

  const featured = profile?.featured;
  const isVisible = Boolean(featured?.enabled && featured?.visible);
  const items = useMemo(() => (profile ? linkItemsFromProfile(profile) : []), [profile]);

  if (!profile || !isVisible) return null;

  return (
    <section className="container pt-6">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {profile.photoUrl ? (
              <img
                src={profile.photoUrl}
                alt="Featured profile photo"
                className="h-16 w-16 rounded-full object-cover border border-border"
              />
            ) : null}
            <div>
              <h2 className="text-lg font-semibold">{featured?.title || "Featured"}</h2>
              {featured?.tagline ? (
                <p className="text-sm text-muted-foreground">{featured.tagline}</p>
              ) : null}
            </div>
          </div>

          {items.length ? (
            <div className="flex flex-wrap items-center gap-2">
              {items.map((i) => {
                const Icon = iconFor(i.platform);
                return (
                  <a
                    key={i.href}
                    href={i.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="capitalize">{i.label}</span>
                  </a>
                );
              })}
            </div>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
