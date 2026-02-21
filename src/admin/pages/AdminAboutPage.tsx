import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  Phone,
  Mail,
  MapPin,
  Share2,
  Loader2,
} from "lucide-react";

type SocialLinks = {
  instagram: string;
  facebook: string;
  twitter: string;
  youtube: string;
  whatsapp: string;
};

type AboutSettings = {
  tagline: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  socialLinks: SocialLinks;
  updatedAt?: any;
};

const defaultAbout: AboutSettings = {
  tagline:
    "Your one-stop shop for trending beauty products, elegant jewelry, and stylish accessories.",
  description:
    "TrendMix was founded with a passion for bringing the latest beauty and fashion trends to everyone. We curate high-quality products from trusted suppliers to ensure you always look and feel your best.",
  address: "01, Vajirivas, Padla, Gujarat, India",
  phone: "+91 7043813824",
  email: "moinbhatti089@gmail.com",
  socialLinks: {
    instagram: "",
    facebook: "",
    twitter: "",
    youtube: "",
    whatsapp: "",
  },
};

export default function AdminAboutPage() {
  const [about, setAbout] = useState<AboutSettings>(defaultAbout);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "about"));
        if (snap.exists()) {
          const data = snap.data() as Partial<AboutSettings>;
          setAbout({
            ...defaultAbout,
            ...data,
            socialLinks: {
              ...defaultAbout.socialLinks,
              ...(data.socialLinks ?? {}),
            },
          });
        }
      } catch (e) {
        console.error("Failed to load about settings:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const update = <K extends keyof AboutSettings>(key: K, value: AboutSettings[K]) =>
    setAbout((prev) => ({ ...prev, [key]: value }));

  const updateSocial = (key: keyof SocialLinks, value: string) =>
    setAbout((prev) => ({
      ...prev,
      socialLinks: { ...prev.socialLinks, [key]: value },
    }));

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "about"), {
        ...about,
        updatedAt: serverTimestamp(),
      });
      toast.success("About page saved successfully");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save about page");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">About Page</h1>
          <p className="text-sm text-muted-foreground">
            Manage the content displayed on the public About page
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Brand Story */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Brand Story
            </CardTitle>
            <CardDescription>
              Tagline and description shown at the top of the About page
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                value={about.tagline}
                onChange={(e) => update("tagline", e.target.value)}
                placeholder="Your one-stop shop for…"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">About Description</Label>
              <Textarea
                id="description"
                rows={5}
                value={about.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Tell your brand story…"
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-4 w-4" />
              Contact Information
            </CardTitle>
            <CardDescription>
              Address, phone, and email shown in the About / Contact section
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="address">
                <MapPin className="inline h-3.5 w-3.5 mr-1 opacity-70" />
                Address
              </Label>
              <Textarea
                id="address"
                rows={2}
                value={about.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="01, Vajirivas, Padla, Gujarat, India"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="phone">
                  <Phone className="inline h-3.5 w-3.5 mr-1 opacity-70" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  value={about.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="+91 7043813824"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">
                  <Mail className="inline h-3.5 w-3.5 mr-1 opacity-70" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={about.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="moinbhatti089@gmail.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Social Media Links */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Share2 className="h-4 w-4" />
              Social Media Links
            </CardTitle>
            <CardDescription>
              Leave blank to hide a platform from the About page
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="instagram">Instagram URL</Label>
                <Input
                  id="instagram"
                  value={about.socialLinks.instagram}
                  onChange={(e) => updateSocial("instagram", e.target.value)}
                  placeholder="https://instagram.com/yourhandle"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="facebook">Facebook URL</Label>
                <Input
                  id="facebook"
                  value={about.socialLinks.facebook}
                  onChange={(e) => updateSocial("facebook", e.target.value)}
                  placeholder="https://facebook.com/yourpage"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="twitter">Twitter / X URL</Label>
                <Input
                  id="twitter"
                  value={about.socialLinks.twitter}
                  onChange={(e) => updateSocial("twitter", e.target.value)}
                  placeholder="https://twitter.com/yourhandle"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="youtube">YouTube URL</Label>
                <Input
                  id="youtube"
                  value={about.socialLinks.youtube}
                  onChange={(e) => updateSocial("youtube", e.target.value)}
                  placeholder="https://youtube.com/@yourchannel"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="whatsapp">WhatsApp Number</Label>
                <Input
                  id="whatsapp"
                  value={about.socialLinks.whatsapp}
                  onChange={(e) => updateSocial("whatsapp", e.target.value)}
                  placeholder="+917043813824"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
