import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  images?: string[];
  alt: string;
  className?: string;
  onImageChange?: (url: string | null) => void;
};

export default function ProductImageGallery({ images, alt, className, onImageChange }: Props) {
  const safeImages = useMemo(() => (images ?? []).filter(Boolean), [images]);
  const [selected, setSelected] = useState<string | null>(safeImages[0] ?? null);

  useEffect(() => {
    const first = safeImages[0] ?? null;
    setSelected(first);
    onImageChange?.(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeImages.join("|")]);

  useEffect(() => {
    onImageChange?.(selected);
  }, [selected, onImageChange]);

  return (
    <section className={cn("space-y-4", className)} aria-label="Product images">
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="relative aspect-square bg-muted">
            {selected ? (
              <div className="group relative h-full w-full overflow-hidden">
                <img
                  src={selected}
                  alt={alt}
                  className={cn(
                    "h-full w-full object-cover",
                    "transition-transform duration-300 ease-out",
                    "sm:group-hover:scale-[1.25]",
                  )}
                  loading="eager"
                  decoding="async"
                />
                <div className="pointer-events-none absolute inset-0 hidden sm:block">
                  <div className="absolute bottom-3 left-3 rounded-full bg-background/70 px-3 py-1 text-xs text-foreground shadow-sm backdrop-blur">
                    Hover to zoom
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full w-full" />
            )}
          </div>
        </CardContent>
      </Card>

      {safeImages.length > 1 ? (
        <div className="space-y-2">
          <div className="hidden sm:flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {safeImages.map((url, idx) => (
              <button
                key={`${url}-${idx}`}
                type="button"
                onClick={() => setSelected(url)}
                className={cn(
                  "relative aspect-square w-20 flex-none overflow-hidden rounded-lg border bg-muted",
                  "transition-all duration-200",
                  selected === url
                    ? "ring-2 ring-primary ring-offset-2 opacity-100"
                    : "opacity-70 hover:opacity-100 hover:ring-2 hover:ring-primary/50",
                )}
                aria-label={`View image ${idx + 1}`}
              >
                <img
                  src={url}
                  alt={`${alt} thumbnail ${idx + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </button>
            ))}
          </div>

          {/* Mobile: scroll-snap slider */}
          <div className="sm:hidden">
            <div className="flex gap-3 overflow-x-auto scroll-smooth pb-2 snap-x snap-mandatory scrollbar-hide">
              {safeImages.map((url, idx) => (
                <button
                  key={`${url}-mobile-${idx}`}
                  type="button"
                  onClick={() => setSelected(url)}
                  className={cn(
                    "snap-start w-[78%] flex-none",
                    "overflow-hidden rounded-xl border bg-muted",
                    selected === url ? "ring-2 ring-primary ring-offset-2" : "",
                  )}
                  aria-label={`Select image ${idx + 1}`}
                >
                  <div className="aspect-square">
                    <img
                      src={url}
                      alt={`${alt} image ${idx + 1}`}
                      className="h-full w-full object-cover"
                      loading={idx === 0 ? "eager" : "lazy"}
                      decoding="async"
                    />
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Swipe to see more</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
