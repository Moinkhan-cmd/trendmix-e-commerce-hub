import { useEffect, useMemo, useState } from "react";
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
import type { CategoryDoc, ProductDoc } from "@/lib/models";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  price: "",
  categoryId: "",
  description: "",
  stock: "in",
  published: true,
  imageUrls: [""],
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Array<WithId<ProductDoc>>>([]);
  const [categories, setCategories] = useState<Array<WithId<CategoryDoc>>>([]);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<WithId<ProductDoc> | null>(null);

  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, "products"), (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProductDoc) })));
    });
    const unsubCategories = onSnapshot(collection(db, "categories"), (snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CategoryDoc) })));
    });

    return () => {
      unsubProducts();
      unsubCategories();
    };
  }, []);

  const categoryById = useMemo(() => {
    const map = new Map<string, WithId<CategoryDoc>>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const resetDialog = () => {
    setEditing(null);
    setForm({ ...emptyForm });
  };

  const openCreate = () => {
    resetDialog();
    setOpen(true);
  };

  const openEdit = (p: WithId<ProductDoc>) => {
    setEditing(p);
    setForm({
      name: p.name ?? "",
      price: String(p.price ?? ""),
      categoryId: p.categoryId ?? "",
      description: p.description ?? "",
      stock: Number(p.stock ?? 0) > 0 ? "in" : "out",
      published: Boolean(p.published),
      imageUrls: Array.isArray(p.imageUrls) && p.imageUrls.length ? p.imageUrls : [""],
    });
    setOpen(true);
  };

  const validate = () => {
    if (!form.name.trim()) return "Product name is required";
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) return "Price must be a valid number";
    if (form.stock !== "in" && form.stock !== "out") return "Stock is required";
    if (!form.categoryId) return "Category is required";
    const urls = form.imageUrls.map((u) => u.trim()).filter(Boolean);
    if (urls.length === 0) return "At least 1 Image URL is required";
    return null;
  };

  const onSave = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    const price = Number(form.price);
    const stock = form.stock === "in" ? 1 : 0;
    const urls = form.imageUrls.map((u) => u.trim()).filter(Boolean);
    const cat = categoryById.get(form.categoryId);

    if (!cat) {
      toast.error("Selected category not found");
      return;
    }

    const payload: ProductDoc = {
      name: form.name.trim(),
      price,
      categoryId: cat.id,
      categorySlug: cat.slug,
      description: form.description.trim(),
      stock,
      imageUrls: urls,
      published: form.published,
      updatedAt: serverTimestamp() as any,
      createdAt: (editing ? undefined : (serverTimestamp() as any)) as any,
    };

    setSaving(true);
    try {
      if (editing) {
        const ref = doc(db, "products", editing.id);
        const { createdAt, ...rest } = payload;
        await updateDoc(ref, rest as any);
        toast.success("Product updated");
      } else {
        const ref = collection(db, "products");
        await addDoc(ref, payload as any);
        toast.success("Product created");
      }
      setOpen(false);
      resetDialog();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (p: WithId<ProductDoc>) => {
    const ok = confirm(`Delete "${p.name}"?`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "products", p.id));
      toast.success("Product deleted");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete product");
    }
  };

  const togglePublished = async (p: WithId<ProductDoc>, next: boolean) => {
    try {
      await updateDoc(doc(db, "products", p.id), {
        published: next,
        updatedAt: serverTimestamp(),
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update publish status");
    }
  };

  const updateImageUrl = (idx: number, value: string) => {
    setForm((prev) => {
      const next = [...prev.imageUrls];
      next[idx] = value;
      return { ...prev, imageUrls: next };
    });
  };

  const addImageUrlField = () => {
    setForm((prev) => ({ ...prev, imageUrls: [...prev.imageUrls, ""] }));
  };

  const removeImageUrlField = (idx: number) => {
    setForm((prev) => {
      const next = prev.imageUrls.filter((_, i) => i !== idx);
      return { ...prev, imageUrls: next.length ? next : [""] };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground">
            Create, edit, publish/unpublish, and delete products.
          </p>
        </div>
        <Button onClick={openCreate}>Add product</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.categorySlug}</TableCell>
                    <TableCell className="text-right">₹{Number(p.price ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{p.stock ?? 0}</TableCell>
                    <TableCell>
                      <Switch
                        checked={Boolean(p.published)}
                        onCheckedChange={(v) => togglePublished(p, v)}
                      />
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => onDelete(p)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {products.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      No products yet.
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
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
            <DialogDescription>
              Use external image hosting and paste Image URLs (no uploads).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="price">Price</Label>
                <Input id="price" inputMode="decimal" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Stock</Label>
                <RadioGroup
                  value={form.stock}
                  onValueChange={(v) => setForm((p) => ({ ...p, stock: v }))}
                  className="grid gap-3"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="in" id="stock-in" />
                    <Label htmlFor="stock-in">In stock</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="out" id="stock-out" />
                    <Label htmlFor="stock-out">Out of stock</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm((p) => ({ ...p, categoryId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categories.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Create a category first.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Published</Label>
                <Switch checked={form.published} onCheckedChange={(v) => setForm((p) => ({ ...p, published: v }))} />
              </div>
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <Label>Image URLs</Label>
                <Button type="button" variant="outline" size="sm" onClick={addImageUrlField}>
                  Add URL
                </Button>
              </div>
              <div className="space-y-2">
                {form.imageUrls.map((url, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      placeholder="https://..."
                      value={url}
                      onChange={(e) => updateImageUrl(idx, e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeImageUrlField(idx)}
                      disabled={form.imageUrls.length === 1}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
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
