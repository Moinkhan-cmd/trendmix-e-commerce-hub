import { Truck, ShieldCheck, RotateCcw, Headphones } from "lucide-react";

const features = [
  {
    icon: Truck,
    title: "Free Shipping",
    description: "Free delivery on orders above ₹499. Fast & reliable nationwide shipping.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Payments",
    description: "100% secure checkout with multiple payment options and encryption.",
  },
  {
    icon: RotateCcw,
    title: "Easy Returns",
    description: "Hassle-free 7-day return policy. No questions asked.",
  },
  {
    icon: Headphones,
    title: "24/7 Support",
    description: "Our support team is always here to help you with any queries.",
  },
];

const WhyChooseUs = () => {
  return (
    <section className="relative border-y border-border/30 bg-gradient-to-b from-transparent via-muted/10 to-transparent overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-0 w-72 h-72 bg-secondary/5 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute top-1/2 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl -translate-y-1/2" />
      </div>

      <div className="container relative py-16 md:py-20">
        <div className="mx-auto max-w-3xl text-center mb-12">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary/10 border border-secondary/20 px-4 py-1.5 text-sm font-medium text-secondary mb-4">
            💎 Why TrendMix
          </span>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Why Customers Love Us
          </h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
            We go above and beyond to ensure you have the best shopping experience.
          </p>
        </div>

        <div className="mx-auto max-w-5xl grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, idx) => (
            <div
              key={f.title}
              className={`group relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 text-center transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 reveal-up stagger-${idx + 1}`}
            >
              {/* Hover glow */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/10 transition-all duration-500 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/20 group-hover:from-primary/20 group-hover:to-secondary/20">
                  <f.icon className="h-6 w-6 text-primary transition-transform duration-500 group-hover:scale-110" />
                </div>
                <h3 className="text-base font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;
