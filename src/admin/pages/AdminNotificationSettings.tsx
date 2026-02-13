import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Mail, Settings } from "lucide-react";

const FUNCTIONS_BASE_URL = import.meta.env.VITE_FIREBASE_FUNCTIONS_URL
  || "https://us-central1-trendmix-admin.cloudfunctions.net";
const NOTIFICATION_HEALTH_URL = `${FUNCTIONS_BASE_URL}/getNotificationHealth`;

const notificationSettingsSchema = z.object({
  adminEmail: z.string().email("Invalid email address"),
  notifyOnNewOrder: z.boolean().default(true),
  sendCustomerConfirmation: z.boolean().default(false),
});

type NotificationSettingsFormValues = z.infer<typeof notificationSettingsSchema>;

const defaultValues: NotificationSettingsFormValues = {
  adminEmail: "",
  notifyOnNewOrder: true,
  sendCustomerConfirmation: false,
};

export default function AdminNotificationSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [health, setHealth] = useState<{
    sendgridKeyConfigured: boolean;
    fromEmailConfigured: boolean;
    adminEmailConfigured: boolean;
    sendgridReadyForAdminNotifications: boolean;
    adminEmailSource: "settings" | "functions-config" | "missing";
  } | null>(null);

  const form = useForm<NotificationSettingsFormValues>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues,
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const docRef = doc(db, "settings", "notifications");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as NotificationSettingsFormValues;
          form.reset({
            ...defaultValues,
            ...data,
          });
        }
      } catch (error) {
        console.error("Error loading notification settings:", error);
        toast.error("Failed to load notification settings");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [form]);

  useEffect(() => {
    const loadNotificationHealth = async () => {
      setHealthLoading(true);
      setHealthError(null);

      try {
        const user = auth.currentUser;
        if (!user) {
          setHealthError("Please sign in as admin to check backend status.");
          return;
        }

        const token = await user.getIdToken();
        const response = await fetch(NOTIFICATION_HEALTH_URL, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(errorData.error || "Failed to load backend notification health");
        }

        const payload = (await response.json()) as {
          success: boolean;
          health?: {
            sendgridKeyConfigured: boolean;
            fromEmailConfigured: boolean;
            adminEmailConfigured: boolean;
            sendgridReadyForAdminNotifications: boolean;
            adminEmailSource: "settings" | "functions-config" | "missing";
          };
        };

        if (!payload.success || !payload.health) {
          throw new Error("Invalid backend health response");
        }

        setHealth(payload.health);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load backend status";
        setHealthError(message);
      } finally {
        setHealthLoading(false);
      }
    };

    loadNotificationHealth();
  }, []);

  const onSubmit = async (data: NotificationSettingsFormValues) => {
    setSaving(true);
    try {
      const docRef = doc(db, "settings", "notifications");
      await setDoc(docRef, data, { merge: true });
      toast.success("Notification settings saved successfully");
    } catch (error) {
      console.error("Error saving notification settings:", error);
      toast.error("Failed to save notification settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notification Settings</h1>
        <p className="text-muted-foreground">
          Configure order notification behavior. Delivery is handled by backend Cloud Functions using SendGrid.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SendGrid Backend Health</CardTitle>
          <CardDescription>
            Secure readiness check from backend (no secret values exposed).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {healthLoading ? (
            <div className="flex items-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking backend configuration...
            </div>
          ) : healthError ? (
            <p className="text-destructive">{healthError}</p>
          ) : health ? (
            <>
              <p>API key: <strong>{health.sendgridKeyConfigured ? "Configured" : "Missing"}</strong></p>
              <p>From email: <strong>{health.fromEmailConfigured ? "Configured" : "Missing"}</strong></p>
              <p>Admin email: <strong>{health.adminEmailConfigured ? "Configured" : "Missing"}</strong> ({health.adminEmailSource})</p>
              <p>
                Overall: <strong>{health.sendgridReadyForAdminNotifications ? "Ready" : "Not ready"}</strong>
              </p>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Admin Notification Target
              </CardTitle>
              <CardDescription>
                Set the admin inbox for paid-order alerts. SendGrid API key/from address are configured in Firebase Functions config.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="adminEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin Email *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="admin@example.com" {...field} />
                    </FormControl>
                    <FormDescription>
                      This value is read by backend function `onOrderCreatedSendEmailNotifications`.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose which events trigger email notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="notifyOnNewOrder"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">New Order Notifications</FormLabel>
                      <FormDescription>
                        Receive an email after successful payment verification and order creation
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sendCustomerConfirmation"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Customer Confirmation Email</FormLabel>
                      <FormDescription>
                        Send optional customer confirmation email for successful paid orders
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Separator />

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Settings"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
