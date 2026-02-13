import { Facebook, Instagram, Twitter, Mail, MapPin, Phone, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import logoImg from "@/assets/logo.webp";

const Footer = () => {
  return (
    <footer className="relative w-full border-t border-border/50 bg-gradient-to-b from-muted/30 to-muted/50 overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-secondary/3 rounded-full blur-3xl" />
      </div>
      
      <div className="container relative py-14 md:py-20">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand section */}
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/30 to-secondary/30 blur-md" />
                <img src={logoImg} alt="TrendMix logo" className="relative h-10 w-10 rounded-full object-cover border-2 border-background shadow-lg" />
              </div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-primary via-primary/90 to-secondary bg-clip-text text-transparent">
                TrendMix
              </h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your one-stop shop for trending beauty products, elegant jewelry, and stylish accessories. Quality meets affordability.
            </p>
            <div className="flex gap-2">
              {[
                { icon: Facebook, href: "#", label: "Facebook" },
                { icon: Instagram, href: "#", label: "Instagram" },
                { icon: Twitter, href: "#", label: "Twitter" },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/50 bg-background/50 text-muted-foreground transition-all duration-300 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:scale-110 hover:shadow-lg hover:shadow-primary/20"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Shop links */}
          <div className="space-y-5">
            <h4 className="font-semibold text-foreground">Shop</h4>
            <ul className="space-y-3 text-sm">
              {[
                { to: "/products", label: "All Products" },
                { to: "/products?category=cosmetic", label: "Cosmetics" },
                { to: "/products?category=jewelry", label: "Jewelry" },
                { to: "/products?category=socks", label: "Socks" },
                { to: "/products?category=accessories", label: "Accessories" },
              ].map(({ to, label }) => (
                <li key={label}>
                  <Link
                    to={to}
                    className="group inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors duration-300"
                  >
                    <ArrowRight className="h-3 w-3 opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" />
                    <span>{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Service links */}
          <div className="space-y-5">
            <h4 className="font-semibold text-foreground">Customer Service</h4>
            <ul className="space-y-3 text-sm">
              {[
                { to: "/about", label: "About Us" },
                { to: "/contact", label: "Contact" },
                { to: "/shipping", label: "Shipping Info" },
                { to: "/returns", label: "Returns" },
                { to: "/faq", label: "FAQ" },
              ].map(({ to, label }) => (
                <li key={label}>
                  <Link
                    to={to}
                    className="group inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors duration-300"
                  >
                    <ArrowRight className="h-3 w-3 opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" />
                    <span>{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact info */}
          <div className="space-y-5">
            <h4 className="font-semibold text-foreground">Contact Us</h4>
            <ul className="space-y-4 text-sm">
              {[
                { icon: MapPin, text: "123 Fashion Street, Mumbai, India" },
                { icon: Phone, text: "+91 98765 43210" },
                { icon: Mail, text: "support@trendmix.com" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-muted-foreground group">
                  <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted/50 border border-border/50 transition-colors duration-300 group-hover:bg-primary/10 group-hover:border-primary/20">
                    <Icon className="h-4 w-4 transition-colors group-hover:text-primary" />
                  </span>
                  <span className="leading-relaxed">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 border-t border-border/50 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 text-center text-sm text-muted-foreground sm:flex-row">
            <p>&copy; 2026 TrendMix Store. All rights reserved.</p>
            <p className="inline-flex items-center gap-1.5">
              Made with
              <span className="inline-flex items-center" aria-label="love" title="love">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-destructive motion-reduce:animate-none animate-heartbeat"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 21s-7.2-4.6-9.6-8.6C.7 9.6 2.1 6.8 4.9 5.9c1.8-.6 3.8 0 5.1 1.5L12 9.6l2-2.2c1.3-1.5 3.3-2.1 5.1-1.5 2.8.9 4.2 3.7 2.5 6.5C19.2 16.4 12 21 12 21z" />
                </svg>
              </span>
              by <span className="font-medium text-foreground">Moinkhan</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
