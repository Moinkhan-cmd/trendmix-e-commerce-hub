import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import heroBanner from "@/assets/hero-banner.jpg";

const Hero = () => {
  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-br from-primary/5 via-secondary/5 to-background">
      <div className="container py-16 md:py-24">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center">
          <div className="flex flex-col justify-center space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-primary self-center lg:self-start">
              <Sparkles className="h-4 w-4" />
              <span>New Arrivals Daily</span>
            </div>
            
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
              Discover Your
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {" "}Perfect Style
              </span>
            </h1>
            
            <p className="max-w-[600px] text-muted-foreground text-lg md:text-xl self-center lg:self-start">
              Shop the latest trends in beauty, jewelry, and fashion accessories. 
              Curated collections that blend style with affordability.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 self-center lg:self-start">
              <Button size="lg" variant="hero" className="group">
                Shop Now
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button size="lg" variant="outline">
                View Collections
              </Button>
            </div>

            <div className="flex items-center gap-8 pt-4 self-center lg:self-start">
              <div>
                <p className="text-2xl font-bold">2000+</p>
                <p className="text-sm text-muted-foreground">Products</p>
              </div>
              <div className="h-12 w-px bg-border" />
              <div>
                <p className="text-2xl font-bold">50k+</p>
                <p className="text-sm text-muted-foreground">Happy Customers</p>
              </div>
              <div className="h-12 w-px bg-border" />
              <div>
                <p className="text-2xl font-bold">4.8★</p>
                <p className="text-sm text-muted-foreground">Average Rating</p>
              </div>
            </div>
          </div>

          <div className="relative flex items-center justify-center lg:justify-end">
            <div className="relative w-full max-w-lg">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-3xl blur-2xl opacity-50" />
              <img
                src={heroBanner}
                alt="TrendMix featured products showcase"
                className="relative rounded-2xl shadow-2xl w-full h-auto object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
