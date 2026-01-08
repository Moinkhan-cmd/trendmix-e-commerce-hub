import { useEffect, useMemo, useState } from "react";
import { doc, deleteDoc, deleteField, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import type { PersonalProfileDoc } from "@/lib/models";
import { buildInstagramUrl, buildXUrl, inferPlatformFromUrl, normalizeUrl, sanitizeRichTextHtml } from "@/lib/profile";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import RichTextEditor from "@/admin/components/RichTextEditor";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Github, Instagram, Linkedin, Link as LinkIcon, Loader2, Trash2, Twitter, Upload } from "lucide-react";

const PROFILE_REF = doc(db, "settings", "personalProfile");
const PHOTO_PATH = "personalProfile/photo";

type LinkForm = { label: string; url: string; platform?: string };
type FormValues = {
  email: string;
  location: string;
  instagramId: string;
  xId: string;
  socialLinks: LinkForm[];
  bioHtml: string;
  featured: { enabled: boolean; visible: boolean; title: string; tagline: string };
};

function isValidUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

const schema: z.ZodType<FormValues> = z
  .object({
    email: z.string().trim().email("Enter a valid email"),
    location: z.string().trim().min(2, "Location is required"),
    instagramId: z.string().trim().optional().default(""),
    xId: z.string().trim().optional().default(""),
    socialLinks: z.array(z.object({
      label: z.string().trim().optional().default(""),
      url: z.string().trim().default(""),
      platform: z.string().trim().optional().default(""),
    })),
    bioHtml: z.string().default(""),
    featured: z.object({
      enabled: z.boolean().default(false),
      visible: z.boolean().default(true),
      title: z.string().trim().default(""),
      tagline: z.string().trim().default(""),
    }),
  })
  .superRefine((v, ctx) => {
    if (v.featured.enabled && !v.featured.title.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Featured title is required when enabled", path: ["featured", "title"] });
    }
    v.socialLinks.forEach((l, idx) => {
      const raw = l.url.trim();
      if (!raw) return;
      const normalized = normalizeUrl(raw);
      if (!isValidUrl(normalized)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid URL", path: ["socialLinks", idx, "url"] });
      }
    });
  });

function iconFor(platform: string) {
  switch (platform) {
    case "instagram":
      return Instagram;
    case "x":
    case "twitter":
      return Twitter;
    case "linkedin":
      return Linkedin;
    case "github":
      return Github;
    default:
      return LinkIcon;
  }
}

function previewLinks(values: FormValues) {
  const items: Array<{ href: string; label: string; platform: string }> = [];
  if (values.instagramId.trim()) items.push({ href: buildInstagramUrl(values.instagramId), label: "Instagram", platform: "instagram" });
  if (values.xId.trim()) items.push({ href: buildXUrl(values.xId), label: "X", platform: "x" });
  for (const l of values.socialLinks) {
    const href = normalizeUrl(l.url);
    if (!href.trim()) continue;
    const platform = l.platform?.trim() || inferPlatformFromUrl(href) || "website";
    const label = l.label?.trim() || platform;
    items.push({ href, label, platform });
  }
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.href) ? false : (seen.add(i.href), true)));
}

export default function AdminProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      location: "",
      instagramId: "",
      xId: "",
      socialLinks: [{ label: "", url: "" }],
      bioHtml: "",
      featured: { enabled: false, visible: true, title: "", tagline: "" },
    },
  });

  const { control, handleSubmit, formState, reset, watch, setValue, register } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "socialLinks" });

  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  useEffect(() => {
    const unsub = onSnapshot(
      PROFILE_REF,
      (snap) => {
      setHasProfile(snap.exists());
      if (!snap.exists()) {
        setLoading(false);
        if (!formState.isDirty) {
          reset({
            email: "",
            location: "",
            instagramId: "",
            xId: "",
            socialLinks: [{ label: "", url: "" }],
            bioHtml: "",
            featured: { enabled: false, visible: true, title: "", tagline: "" },
          }
      ,
      (err) => {
        console.error(\"Failed to subscribe to personal profile:\", err);
        toast.error(err?.message ?? \"Failed to load profile\");
        setLoading(false);
      }
    );
          setPhotoUrl(null);
          setPhotoPath(null);
        }
        return;
      }

      const data = snap.data() as PersonalProfileDoc;
      setLoading(false);

      if (formState.isDirty) return;

      reset({
        email: data.email ?? "",
        location: data.location ?? "",
        instagramId: data.instagramId ?? "",
        xId: data.xId ?? "",
        socialLinks: Array.isArray(data.socialLinks) && data.socialLinks.length
          ? data.socialLinks.map((l) => ({ label: l.label ?? "", url: l.url ?? "", platform: (l as any).platform ?? "" }))
          : [{ label: "", url: "" }],
        bioHtml: data.bioHtml ?? "",
        featured: {
          enabled: Boolean(data.featured?.enabled),
          visible: data.featured?.visible !== false,
          title: data.featured?.title ?? "",
          tagline: data.featured?.tagline ?? "",
        },
      });
      setPhotoUrl(data.photoUrl ?? null);
      setPhotoPath(data.photoPath ?? null);
    });
    return unsub;
  }, [reset, formState.isDirty]);

  const values = watch();
  const previewItems = useMemo(() => previewLinks(values), [values]);

  const onPickFile = (f: File | null) => {
    setFile(f);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(f ? URL.createObjectURL(f) : null);
  };

  const removePhoto = async () => {
    if (!photoPath) return;
    setSaving(true);
    try {
      await deleteObject(storageRef(storage, photoPath));
      await setDoc(PROFILE_REF, {
        photoUrl: deleteField(),
        photoPath: deleteField(),
        updatedAt: serverTimestamp(),
      } as any, { merge: true });
      setPhotoUrl(null);
      setPhotoPath(null);
      toast.success("Profile photo removed");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to remove photo");
    } finally {
      setSaving(false);
    }
  };

  const onDeleteProfile = async () => {
    setSaving(true);
    try {
      if (photoPath) {
        await deleteObject(storageRef(storage, photoPath));
      }
      await deleteDoc(PROFILE_REF);
      toast.success("Profile deleted");
      setFile(null);
      if (filePreview) URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete profile");
    } finally {
      setSaving(false);
    }
  };

  const onSave = handleSubmit(async (v) => {
    setSaving(true);
    try {
      const socialLinks = v.socialLinks
        .map((l) => ({
          label: l.label.trim(),
          url: l.url.trim(),
          platform: l.platform?.trim(),
        }))
        .filter((l) => Boolean(l.url));

      const normalizedLinks = socialLinks.map((l) => {
        const href = normalizeUrl(l.url);
        if (!isValidUrl(href)) throw new Error(`Invalid URL: ${l.url}`);
        return {
          url: href,
          label: l.label || undefined,
          platform: l.platform || inferPlatformFromUrl(href) || undefined,
        };
      });

      let nextPhotoUrl = photoUrl;
      let nextPhotoPath = photoPath;

      if (file) {
        const r = storageRef(storage, PHOTO_PATH);
        await uploadBytes(r, file, { contentType: file.type });
        nextPhotoUrl = await getDownloadURL(r);
        nextPhotoPath = PHOTO_PATH;
      }

      const payload: Partial<PersonalProfileDoc> = {
        email: v.email.trim(),
        location: v.location.trim(),
        instagramId: v.instagramId.trim() || undefined,
        xId: v.xId.trim() || undefined,
        socialLinks: normalizedLinks as any,
        bioHtml: sanitizeRichTextHtml(v.bioHtml),
        featured: {
          enabled: Boolean(v.featured.enabled),
          visible: Boolean(v.featured.visible),
          title: v.featured.title.trim(),
          tagline: v.featured.tagline.trim(),
        },
        updatedAt: serverTimestamp() as any,
      };

      if (nextPhotoUrl) payload.photoUrl = nextPhotoUrl;
      if (nextPhotoPath) payload.photoPath = nextPhotoPath;
      if (!hasProfile) payload.createdAt = serverTimestamp() as any;

      await setDoc(PROFILE_REF, payload as any, { merge: true });
      toast.success(hasProfile ? "Profile updated" : "Profile created");
      setFile(null);
      if (filePreview) URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  });

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
          <h1 className="text-2xl font-semibold">Personal Profile Management</h1>
          <p className="text-sm text-muted-foreground">Manage your personal profile and featured banner</p>
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={!hasProfile || saving}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete profile?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the profile document (and profile photo if uploaded).
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDeleteProfile}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="edit" className="w-full">
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal Details</CardTitle>
              <CardDescription>Email, location, and handles</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...register("email")} />
                  {formState.errors.email ? (
                    <p className="text-sm text-destructive">{formState.errors.email.message}</p>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" {...register("location")} />
                  {formState.errors.location ? (
                    <p className="text-sm text-destructive">{formState.errors.location.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="instagramId">Instagram ID</Label>
                  <Input id="instagramId" placeholder="@yourhandle" {...register("instagramId")} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="xId">X (Twitter) ID</Label>
                  <Input id="xId" placeholder="@yourhandle" {...register("xId")} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bio / About</CardTitle>
              <CardDescription>Rich-text supported</CardDescription>
            </CardHeader>
            <CardContent>
              <RichTextEditor
                value={values.bioHtml}
                onChange={(html) => setValue("bioHtml", html, { shouldDirty: true })}
                placeholder="Write a short bio..."
                disabled={saving}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Social Links</CardTitle>
              <CardDescription>LinkedIn, GitHub, or any other platform links</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-3">
                {fields.map((f, idx) => (
                  <div key={f.id} className="grid gap-3 sm:grid-cols-[1fr_1.6fr_auto]">
                    <div className="grid gap-2">
                      <Label>Label</Label>
                      <Input {...register(`socialLinks.${idx}.label` as const)} placeholder="LinkedIn" />
                    </div>
                    <div className="grid gap-2">
                      <Label>URL</Label>
                      <Input {...register(`socialLinks.${idx}.url` as const)} placeholder="https://..." />
                      {formState.errors.socialLinks?.[idx]?.url ? (
                        <p className="text-sm text-destructive">{formState.errors.socialLinks[idx]?.url?.message as any}</p>
                      ) : null}
                    </div>
                    <div className="flex items-end">
                      <Button type="button" variant="outline" onClick={() => remove(idx)} disabled={saving || fields.length <= 1}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <Button type="button" variant="outline" onClick={() => append({ label: "", url: "" })} disabled={saving}>
                  Add Link
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile Photo</CardTitle>
              <CardDescription>Optional. Upload a profile photo.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4">
                  <img
                    src={filePreview || photoUrl || `${import.meta.env.BASE_URL}logo.svg`}
                    alt="Profile preview"
                    className="h-20 w-20 rounded-full object-cover border border-border"
                  />
                  <div className="grid gap-2">
                    <Label htmlFor="photo">Choose photo</Label>
                    <Input
                      id="photo"
                      type="file"
                      accept="image/*"
                      disabled={saving}
                      onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                    />
                    <p className="text-xs text-muted-foreground">Saved on next Save.</p>
                  </div>
                </div>

                {photoPath ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="outline" disabled={saving}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove Photo
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove profile photo?</AlertDialogTitle>
                        <AlertDialogDescription>This deletes the uploaded photo from storage.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={removePhoto}>Remove</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Featured Profile</CardTitle>
              <CardDescription>Controls the homepage featured banner</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center justify-between rounded-md border border-border p-4">
                <div>
                  <p className="font-medium">Feature this profile</p>
                  <p className="text-sm text-muted-foreground">Show on the homepage top area</p>
                </div>
                <Switch checked={values.featured.enabled} onCheckedChange={(c) => setValue("featured.enabled", c, { shouldDirty: true })} />
              </div>

              <div className="flex items-center justify-between rounded-md border border-border p-4">
                <div>
                  <p className="font-medium">Visibility</p>
                  <p className="text-sm text-muted-foreground">Show/hide without unfeaturing</p>
                </div>
                <Switch checked={values.featured.visible} onCheckedChange={(c) => setValue("featured.visible", c, { shouldDirty: true })} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="featuredTitle">Featured title/headline</Label>
                  <Input id="featuredTitle" {...register("featured.title")} disabled={!values.featured.enabled} />
                  {formState.errors.featured?.title ? (
                    <p className="text-sm text-destructive">{formState.errors.featured.title.message}</p>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="featuredTagline">Highlight text / tagline</Label>
                  <Input id="featuredTagline" {...register("featured.tagline")} disabled={!values.featured.enabled} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Homepage Preview</CardTitle>
              <CardDescription>Preview before publishing (Save)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!values.featured.enabled || !values.featured.visible ? (
                <p className="text-sm text-muted-foreground">Featured banner is hidden (enable + visible to show).</p>
              ) : (
                <div className="rounded-lg border border-border p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      {(filePreview || photoUrl) ? (
                        <img
                          src={filePreview || photoUrl || undefined}
                          alt="Preview profile photo"
                          className="h-16 w-16 rounded-full object-cover border border-border"
                        />
                      ) : null}
                      <div>
                        <h2 className="text-lg font-semibold">{values.featured.title || "Featured"}</h2>
                        {values.featured.tagline ? (
                          <p className="text-sm text-muted-foreground">{values.featured.tagline}</p>
                        ) : null}
                      </div>
                    </div>

                    {previewItems.length ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {previewItems.map((i) => {
                          const Icon = iconFor(i.platform);
                          return (
                            <a
                              key={i.href}
                              href={i.href}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                            >
                              <Icon className="h-4 w-4" />
                              <span className="capitalize">{i.label}</span>
                            </a>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium mb-2">Bio Preview</h3>
                <div className="prose prose-sm max-w-none dark:prose-invert rounded-md border border-border bg-background p-4" dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(values.bioHtml) }} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
