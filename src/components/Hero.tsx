import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import heroBanner from "@/assets/hero-banner.jpg";

const Hero = () => {
  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-br from-primary/5 via-secondary/5 to-background">
      {/* Background accents */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-secondary/15 blur-3xl" />
      </div>

      <div className="container relative py-16 md:py-24 lg:py-28">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="flex flex-col justify-center space-y-7 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-sm font-medium text-primary backdrop-blur self-center lg:self-start">
              <Sparkles className="h-4 w-4" />
              <span>New Arrivals Daily</span>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
                Discover Your
                <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  {" "}Perfect Style
                </span>
              </h1>

              <p className="mx-auto max-w-[42rem] text-muted-foreground text-lg md:text-xl lg:mx-0">
                Shop the latest trends in beauty, jewelry, and fashion accessories.
                Curated collections that blend style with affordability.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 self-center lg:self-start">
              <Button asChild size="lg" variant="hero" className="group">
                <Link to="/products">
                  Shop Now
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/#categories">View Collections</Link>
              </Button>
            </div>

            <div className="self-center lg:self-start">
              <div className="inline-flex items-center gap-8 rounded-xl border border-border bg-background/60 px-5 py-4 backdrop-blur">
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
            <div className="relative w-full max-w-xl">
              <div className="absolute -inset-6 rounded-[2.25rem] bg-gradient-to-r from-primary/20 to-secondary/20 blur-2xl opacity-60" />
              <div className="relative overflow-hidden rounded-2xl border border-border bg-muted">
                <img
                  src={heroBanner}
                  alt="TrendMix featured products showcase"
                  className="h-auto w-full object-cover"
                />
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
