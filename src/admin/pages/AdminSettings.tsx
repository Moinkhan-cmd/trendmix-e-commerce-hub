import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings, Store, Truck, CreditCard, Bell, Loader2 } from "lucide-react";

type StoreSettings = {
  storeName: string;
  storeEmail: string;
  storePhone: string;
  storeAddress: string;
  currency: string;
  taxRate: number;
  freeShippingThreshold: number;
  shippingFee: number;
  enableNotifications: boolean;
  maintenanceMode: boolean;
  lowStockThreshold: number;
  updatedAt?: any;
};

const defaultSettings: StoreSettings = {
  storeName: "TrendMix",
  storeEmail: "support@trendmix.com",
  storePhone: "+91 9876543210",
  storeAddress: "123 Commerce Street, Mumbai, Maharashtra 400001",
  currency: "INR",
  taxRate: 18,
  freeShippingThreshold: 999,
  shippingFee: 50,
  enableNotifications: true,
  maintenanceMode: false,
  lowStockThreshold: 5,
};

export default function AdminSettings() {
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const docRef = doc(db, "settings", "store");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings({ ...defaultSettings, ...(docSnap.data() as StoreSettings) });
        }
      } catch (e) {
        console.error("Failed to load settings:", e);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, "settings", "store");
      await setDoc(docRef, {
        ...settings,
        updatedAt: serverTimestamp(),
      });
      toast.success("Settings saved successfully");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure your store settings and preferences
          </p>
        </div>
        <Button onClick={saveSettings} disabled={saving}>
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
        {/* Store Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="h-4 w-4" />
              Store Information
            </CardTitle>
            <CardDescription>Basic information about your store</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="storeName">Store Name</Label>
                <Input
                  id="storeName"
                  value={settings.storeName}
                  onChange={(e) => updateSetting("storeName", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="storeEmail">Contact Email</Label>
                <Input
                  id="storeEmail"
                  type="email"
                  value={settings.storeEmail}
                  onChange={(e) => updateSetting("storeEmail", e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="storePhone">Phone Number</Label>
                <Input
                  id="storePhone"
                  value={settings.storePhone}
                  onChange={(e) => updateSetting("storePhone", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  value={settings.currency}
                  onChange={(e) => updateSetting("currency", e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="storeAddress">Store Address</Label>
              <Textarea
                id="storeAddress"
                rows={2}
                value={settings.storeAddress}
                onChange={(e) => updateSetting("storeAddress", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Shipping & Tax */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="h-4 w-4" />
              Shipping & Tax
            </CardTitle>
            <CardDescription>Configure shipping fees and tax rates</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="shippingFee">Shipping Fee (₹)</Label>
                <Input
                  id="shippingFee"
                  type="number"
                  min="0"
                  value={settings.shippingFee}
                  onChange={(e) => updateSetting("shippingFee", Number(e.target.value))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="freeShippingThreshold">Free Shipping Above (₹)</Label>
                <Input
                  id="freeShippingThreshold"
                  type="number"
                  min="0"
                  value={settings.freeShippingThreshold}
                  onChange={(e) => updateSetting("freeShippingThreshold", Number(e.target.value))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  min="0"
                  max="100"
                  value={settings.taxRate}
                  onChange={(e) => updateSetting("taxRate", Number(e.target.value))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inventory */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              Inventory
            </CardTitle>
            <CardDescription>Inventory management settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 max-w-xs">
              <Label htmlFor="lowStockThreshold">Low Stock Alert Threshold</Label>
              <Input
                id="lowStockThreshold"
                type="number"
                min="0"
                value={settings.lowStockThreshold}
                onChange={(e) => updateSetting("lowStockThreshold", Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Products with stock below this number will trigger alerts
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notifications & Maintenance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              System
            </CardTitle>
            <CardDescription>System and notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Receive email notifications for new orders
                </p>
              </div>
              <Switch
                checked={settings.enableNotifications}
                onCheckedChange={(v) => updateSetting("enableNotifications", v)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-destructive">Maintenance Mode</Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, customers cannot place orders
                </p>
              </div>
              <Switch
                checked={settings.maintenanceMode}
                onCheckedChange={(v) => updateSetting("maintenanceMode", v)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
