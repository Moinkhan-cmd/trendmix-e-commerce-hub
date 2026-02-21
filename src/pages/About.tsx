import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { MapPin, Phone, Mail, Instagram, Facebook, Twitter, Youtube, MessageCircle } from "lucide-react";
import { Loader2 } from "lucide-react";

type SocialLinks = {
  instagram: string;
  facebook: string;
  twitter: string;
  youtube: string;
  whatsapp: string;
};

type AboutData = {
  tagline: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  socialLinks: SocialLinks;
};

const defaultAbout: AboutData = {
  tagline:
    "Your one-stop shop for trending beauty products, elegant jewelry, and stylish accessories.",
  description:
    "TrendMix was founded with a passion for bringing the latest beauty and fashion trends to everyone. We curate high-quality products from trusted suppliers to ensure you always look and feel your best.",
  address: "01, Vajirivas, Padla, Gujarat, India",
  phone: "+91 7043813824",
  email: "moinbhatti089@gmail.com",
  socialLinks: { instagram: "", facebook: "", twitter: "", youtube: "", whatsapp: "" },
};

const About = () => {
  const [about, setAbout] = useState<AboutData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDoc(doc(db, "settings", "about"))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<AboutData>;
          setAbout({
            ...defaultAbout,
            ...data,
            socialLinks: { ...defaultAbout.socialLinks, ...(data.socialLinks ?? {}) },
          });
        } else {
          setAbout(defaultAbout);
        }
      })
      .catch(() => setAbout(defaultAbout))
      .finally(() => setLoading(false));
  }, []);

  const data = about ?? defaultAbout;
  const social = data.socialLinks;

  const socialPlatforms = [
    { key: "instagram", label: "Instagram", href: social.instagram, Icon: Instagram, color: "hover:text-pink-500" },
    { key: "facebook",  label: "Facebook",  href: social.facebook,  Icon: Facebook,  color: "hover:text-blue-600" },
    { key: "twitter",   label: "Twitter/X", href: social.twitter,   Icon: Twitter,   color: "hover:text-sky-500" },
    { key: "youtube",   label: "YouTube",   href: social.youtube,   Icon: Youtube,   color: "hover:text-red-600" },
    {
      key: "whatsapp",
      label: "WhatsApp",
      href: social.whatsapp
        ? `https://wa.me/${social.whatsapp.replace(/[^0-9]/g, "")}`
        : "",
      Icon: MessageCircle,
      color: "hover:text-green-500",
    },
  ].filter((p) => p.href);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <section className="container py-12 md:py-16 max-w-4xl">
            {/* Heading */}
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">About Us</h1>
            <p className="mt-4 text-muted-foreground max-w-2xl text-base leading-relaxed">
              {data.tagline}
            </p>

            {/* Brand Story */}
            <div className="mt-8 rounded-xl border border-border bg-background p-6">
              <h2 className="text-lg font-semibold mb-3">Our Story</h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {data.description}
              </p>
            </div>

            {/* Contact Information */}
            <div className="mt-6 rounded-xl border border-border bg-background p-6">
              <h2 className="text-lg font-semibold mb-4">Contact Us</h2>
              <ul className="space-y-3">
                {data.address && (
                  <li className="flex items-start gap-3 text-sm">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">{data.address}</span>
                  </li>
                )}
                {data.phone && (
                  <li className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <a
                      href={`tel:${data.phone}`}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {data.phone}
                    </a>
                  </li>
                )}
                {data.email && (
                  <li className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <a
                      href={`mailto:${data.email}`}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {data.email}
                    </a>
                  </li>
                )}
              </ul>
            </div>

            {/* Social Media */}
            {socialPlatforms.length > 0 && (
              <div className="mt-6 rounded-xl border border-border bg-background p-6">
                <h2 className="text-lg font-semibold mb-4">Follow Us</h2>
                <div className="flex flex-wrap gap-4">
                  {socialPlatforms.map(({ key, label, href, Icon, color }) => (
                    <a
                      key={key}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className={`flex items-center gap-2 text-sm text-muted-foreground transition-colors ${color}`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{label}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default About;
