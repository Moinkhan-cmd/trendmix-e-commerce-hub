import { Facebook, Instagram, Twitter, Mail, MapPin, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import logoImg from "@/assets/logo.png";

const Footer = () => {
  return (
    <footer className="w-full border-t border-border bg-muted/30">
      <div className="container py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img src={logoImg} alt="TrendMix logo" className="h-7 w-7 rounded-full object-cover" />
              <h3 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                TrendMix
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Your one-stop shop for trending beauty products, elegant jewelry, and stylish accessories.
            </p>
            <div className="flex gap-3">
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Shop</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/products" className="text-muted-foreground hover:text-primary transition-colors">
                  All Products
                </Link>
              </li>
              <li>
                <Link
                  to="/products?category=beauty"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Cosmetics
                </Link>
              </li>
              <li>
                <Link
                  to="/products?category=jewelry"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Jewelry
                </Link>
              </li>
              <li>
                <Link to="/products?category=socks" className="text-muted-foreground hover:text-primary transition-colors">
                  Socks
                </Link>
              </li>
              <li>
                <Link
                  to="/products?category=accessories"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Accessories
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Customer Service</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/about" className="text-muted-foreground hover:text-primary transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-muted-foreground hover:text-primary transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/shipping" className="text-muted-foreground hover:text-primary transition-colors">
                  Shipping Info
                </Link>
              </li>
              <li>
                <Link to="/returns" className="text-muted-foreground hover:text-primary transition-colors">
                  Returns
                </Link>
              </li>
              <li>
                <Link to="/faq" className="text-muted-foreground hover:text-primary transition-colors">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Contact Us</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>123 Fashion Street, Mumbai, India</span>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 flex-shrink-0" />
                <span>+91 98765 43210</span>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span>support@trendmix.com</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8 text-center text-sm text-muted-foreground">
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span>&copy; 2026 TrendMix Store.</span>
            <span className="hidden sm:inline">•</span>
            <span className="inline-flex items-center gap-1">
              <span>Made by Moinkhan</span>
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
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
