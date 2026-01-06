import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import emailjs from "@emailjs/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Mail, Send, Settings } from "lucide-react";

const notificationSettingsSchema = z.object({
  emailjsServiceId: z.string().min(1, "Service ID is required"),
  emailjsTemplateId: z.string().min(1, "Template ID is required"),
  emailjsPublicKey: z.string().min(1, "Public Key is required"),
  adminEmail: z.string().email("Invalid email address"),
  notifyOnNewOrder: z.boolean().default(true),
  notifyOnStatusChange: z.boolean().default(true),
  customerOrderConfirmationTemplateId: z.string().optional(),
  customerStatusUpdateTemplateId: z.string().optional(),
});

type NotificationSettingsFormValues = z.infer<typeof notificationSettingsSchema>;

const defaultValues: NotificationSettingsFormValues = {
  emailjsServiceId: "",
  emailjsTemplateId: "",
  emailjsPublicKey: "",
  adminEmail: "",
  notifyOnNewOrder: true,
  notifyOnStatusChange: true,
  customerOrderConfirmationTemplateId: "",
  customerStatusUpdateTemplateId: "",
};

export default function AdminNotificationSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

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

  const testEmail = async () => {
    const values = form.getValues();
    
    if (!values.emailjsServiceId || !values.emailjsTemplateId || !values.emailjsPublicKey || !values.adminEmail) {
      toast.error("Please fill in all required EmailJS fields before testing");
      return;
    }

    setSendingTest(true);
    try {
      await emailjs.send(
        values.emailjsServiceId,
        values.emailjsTemplateId,
        {
          to_email: values.adminEmail,
          subject: "Test Email from TrendMix Admin",
          message: "This is a test email to verify your EmailJS configuration is working correctly.",
          order_id: "TEST-001",
          customer_name: "Test Customer",
          order_total: "$0.00",
        },
        values.emailjsPublicKey
      );
      toast.success("Test email sent successfully! Check your inbox.");
    } catch (error) {
      console.error("Error sending test email:", error);
      toast.error("Failed to send test email. Please check your EmailJS configuration.");
    } finally {
      setSendingTest(false);
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
          Configure email notifications for orders and status updates using EmailJS.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                EmailJS Configuration
              </CardTitle>
              <CardDescription>
                Enter your EmailJS credentials to enable email notifications.
                Get your credentials from{" "}
                <a
                  href="https://www.emailjs.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  emailjs.com
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="emailjsServiceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service ID *</FormLabel>
                    <FormControl>
                      <Input placeholder="service_xxxxxxx" {...field} />
                    </FormControl>
                    <FormDescription>
                      Your EmailJS service ID (found in Email Services)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emailjsTemplateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin Notification Template ID *</FormLabel>
                    <FormControl>
                      <Input placeholder="template_xxxxxxx" {...field} />
                    </FormControl>
                    <FormDescription>
                      Template ID for admin order notifications
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emailjsPublicKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Public Key *</FormLabel>
                    <FormControl>
                      <Input placeholder="xxxxxxxxxxxxxxx" {...field} />
                    </FormControl>
                    <FormDescription>
                      Your EmailJS public key (found in Account &gt; API Keys)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                      Email address to receive admin notifications
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={testEmail}
                  disabled={sendingTest}
                >
                  {sendingTest ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Test Email
                    </>
                  )}
                </Button>
              </div>
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
                        Receive an email when a new order is placed
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
                name="notifyOnStatusChange"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Order Status Change Notifications</FormLabel>
                      <FormDescription>
                        Receive an email when an order status is updated
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer Email Templates (Optional)</CardTitle>
              <CardDescription>
                Configure template IDs for customer-facing emails. Leave blank to disable.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="customerOrderConfirmationTemplateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Confirmation Template ID</FormLabel>
                    <FormControl>
                      <Input placeholder="template_xxxxxxx" {...field} />
                    </FormControl>
                    <FormDescription>
                      Template for sending order confirmations to customers
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerStatusUpdateTemplateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status Update Template ID</FormLabel>
                    <FormControl>
                      <Input placeholder="template_xxxxxxx" {...field} />
                    </FormControl>
                    <FormDescription>
                      Template for sending status updates to customers
                    </FormDescription>
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
