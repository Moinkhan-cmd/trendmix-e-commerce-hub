import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CategoryDoc } from "@/lib/models";
import { slugify } from "@/lib/slug";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type WithId<T> = T & { id: string };

const emptyForm = {
  name: "",
  slug: "",
  imageUrl: "",
};

export default function AdminCategories() {
  const [categories, setCategories] = useState<Array<WithId<CategoryDoc>>>([]);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<WithId<CategoryDoc> | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "categories"), (snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CategoryDoc) })));
    });
    return () => unsub();
  }, []);

  const resetDialog = () => {
    setEditing(null);
    setForm({ ...emptyForm });
  };

  const openCreate = () => {
    resetDialog();
    setOpen(true);
  };

  const openEdit = (c: WithId<CategoryDoc>) => {
    setEditing(c);
    setForm({
      name: c.name ?? "",
      slug: c.slug ?? "",
      imageUrl: c.imageUrl ?? "",
    });
    setOpen(true);
  };

  const validate = () => {
    if (!form.name.trim()) return "Category name is required";
    if (!form.slug.trim()) return "Slug is required";
    if (!form.imageUrl.trim()) return "Image URL is required";
    return null;
  };

  const onSave = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    const payload: CategoryDoc = {
      name: form.name.trim(),
      slug: slugify(form.slug.trim()),
      imageUrl: form.imageUrl.trim(),
      updatedAt: serverTimestamp() as any,
      createdAt: (editing ? undefined : (serverTimestamp() as any)) as any,
    };

    setSaving(true);
    try {
      if (editing) {
        const ref = doc(db, "categories", editing.id);
        const { createdAt, ...rest } = payload;
        await updateDoc(ref, rest as any);
        toast.success("Category updated");
      } else {
        await addDoc(collection(db, "categories"), payload as any);
        toast.success("Category created");
      }
      setOpen(false);
      resetDialog();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (c: WithId<CategoryDoc>) => {
    const ok = confirm(`Delete "${c.name}"?`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "categories", c.id));
      toast.success("Category deleted");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete category");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Categories</h1>
          <p className="text-sm text-muted-foreground">Create, edit, and delete categories.</p>
        </div>
        <Button onClick={openCreate}>Add category</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Image URL</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.slug}</TableCell>
                    <TableCell className="max-w-[360px] truncate">{c.imageUrl}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => onDelete(c)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {categories.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                      No categories yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetDialog();
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "Add category"}</DialogTitle>
            <DialogDescription>Category images are URL-based (no uploads).</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((p) => ({ ...p, name, slug: p.slug ? p.slug : slugify(name) }));
                }}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Used in URLs and product filtering.</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                placeholder="https://..."
                value={form.imageUrl}
                onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
