import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ImageIcon } from "lucide-react";

type Props = {
  images?: string[];
  alt: string;
  className?: string;
  onImageChange?: (url: string | null) => void;
};

export default function ProductImageGallery({ images, alt, className, onImageChange }: Props) {
  const safeImages = useMemo(() => (images ?? []).filter(Boolean), [images]);
  const [selected, setSelected] = useState<string | null>(safeImages[0] ?? null);
  const [broken, setBroken] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const first = safeImages[0] ?? null;
    setSelected(first);
    setBroken(new Set());
    onImageChange?.(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeImages.join("|")]);

  useEffect(() => {
    onImageChange?.(selected);
  }, [selected, onImageChange]);

  return (
    <section className={cn("space-y-2 sm:space-y-3 md:space-y-4", className)} aria-label="Product images">
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="relative aspect-square sm:aspect-[4/3] max-h-[280px] xs:max-h-[320px] sm:max-h-[350px] md:max-h-[400px] bg-muted mx-auto">
            {selected ? (
              <div className="group relative h-full w-full overflow-hidden flex items-center justify-center">
                <img
                  src={selected}
                  alt={alt}
                  className={cn(
                    "max-h-full max-w-full object-contain",
                    "transition-transform duration-300 ease-out",
                    "sm:group-hover:scale-[1.1]",
                  )}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  onError={() => {
                    setBroken((prev) => {
                      const next = new Set(prev);
                      next.add(selected);
                      return next;
                    });

                    // If the selected image fails, move to the next available one.
                    const nextGood = safeImages.find((u) => u && u !== selected);
                    setSelected(nextGood ?? null);
                  }}
                />
                <div className="pointer-events-none absolute inset-0 hidden sm:block">
                  <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 rounded-full bg-background/70 px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs text-foreground shadow-sm backdrop-blur">
                    Hover to zoom
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <div className="flex flex-col items-center gap-1.5 sm:gap-2 text-muted-foreground">
                  <div className="flex h-10 w-10 sm:h-12 md:h-14 sm:w-12 md:w-14 items-center justify-center rounded-xl sm:rounded-2xl border bg-background/60">
                    <ImageIcon className="h-4 w-4 sm:h-5 md:h-6 sm:w-5 md:w-6" />
                  </div>
                  <p className="text-[10px] sm:text-xs">No image available</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {safeImages.length > 1 ? (
        <div className="space-y-1.5 sm:space-y-2">
          <div className="hidden sm:flex gap-2 md:gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {safeImages.map((url, idx) => (
              <button
                key={`${url}-${idx}`}
                type="button"
                onClick={() => setSelected(url)}
                className={cn(
                  "relative aspect-square w-14 sm:w-16 md:w-20 flex-none overflow-hidden rounded-md sm:rounded-lg border bg-muted",
                  "transition-all duration-200",
                  selected === url
                    ? "ring-2 ring-primary ring-offset-1 sm:ring-offset-2 opacity-100"
                    : "opacity-70 hover:opacity-100 hover:ring-2 hover:ring-primary/50",
                )}
                aria-label={`View image ${idx + 1}`}
                disabled={broken.has(url)}
              >
                <img
                  src={url}
                  alt={`${alt} thumbnail ${idx + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                  onError={() => {
                    setBroken((prev) => {
                      const next = new Set(prev);
                      next.add(url);
                      return next;
                    });
                  }}
                />
                {broken.has(url) ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                ) : null}
              </button>
            ))}
          </div>

          {/* Mobile: scroll-snap slider */}
          <div className="sm:hidden">
            <div className="flex gap-2 overflow-x-auto scroll-smooth pb-2 snap-x snap-mandatory scrollbar-hide -mx-3 px-3">
              {safeImages.map((url, idx) => (
                <button
                  key={`${url}-mobile-${idx}`}
                  type="button"
                  onClick={() => setSelected(url)}
                  className={cn(
                    "snap-start w-[65%] xs:w-[70%] flex-none",
                    "overflow-hidden rounded-lg sm:rounded-xl border bg-muted",
                    selected === url ? "ring-2 ring-primary ring-offset-1" : "",
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
                      onError={() => {
                        setBroken((prev) => {
                          const next = new Set(prev);
                          next.add(url);
                          return next;
                        });
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground text-center mt-1">Swipe to see more</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
