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
import { slugify } from "@/lib/slug";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Search, ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";

type WithId<T> = T & { id: string };

const emptyForm = {
  name: "",
  slug: "",
  imageUrl: "",
};

const ITEMS_PER_PAGE = 10;

export default function AdminCategories() {
  const [categories, setCategories] = useState<Array<WithId<CategoryDoc>>>([]);
  const [products, setProducts] = useState<Array<WithId<ProductDoc>>>([]);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<WithId<CategoryDoc> | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const unsubCategories = onSnapshot(
      collection(db, "categories"),
      (snap) => {
        setCategories(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CategoryDoc) })));
      },
      (err) => {
        console.error("Firestore subscription failed (categories):", err);
      }
    );
    const unsubProducts = onSnapshot(
      collection(db, "products"),
      (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProductDoc) })));
      },
      (err) => {
        console.error("Firestore subscription failed (products):", err);
      }
    );
    return () => {
      unsubCategories();
      unsubProducts();
    };
  }, []);

  // Count products per category
  const productCountByCategory = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      map.set(p.categoryId, (map.get(p.categoryId) || 0) + 1);
    });
    return map;
  }, [products]);

  const filteredCategories = useMemo(() => {
    return categories.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase())
    );
  }, [categories, search]);

  const totalPages = Math.ceil(filteredCategories.length / ITEMS_PER_PAGE);
  const paginatedCategories = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCategories.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCategories, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

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

  const seedDefaultCategories = async () => {
    if (categories.length > 0) {
      toast.error("Categories already exist");
      return;
    }

    const ok = confirm("Create default categories?");
    if (!ok) return;

    const defaults: Array<Pick<CategoryDoc, "name" | "slug" | "imageUrl">> = [
      { name: "Clothing", slug: "clothing", imageUrl: "https://placehold.co/600x600/png?text=Clothing" },
      { name: "Henna", slug: "henna", imageUrl: "https://placehold.co/600x600/png?text=Henna" },
      { name: "Accessories", slug: "accessories", imageUrl: "https://placehold.co/600x600/png?text=Accessories" },
      { name: "Jewelry", slug: "jewelry", imageUrl: "https://placehold.co/600x600/png?text=Jewelry" },
      { name: "Beauty", slug: "beauty", imageUrl: "https://placehold.co/600x600/png?text=Beauty" },
      { name: "Electronics", slug: "electronics", imageUrl: "https://placehold.co/600x600/png?text=Electronics" },
      { name: "Home", slug: "home", imageUrl: "https://placehold.co/600x600/png?text=Home" },
      { name: "Bags", slug: "bags", imageUrl: "https://placehold.co/600x600/png?text=Bags" },
    ];

    setSaving(true);
    try {
      const colRef = collection(db, "categories");
      for (const c of defaults) {
        await addDoc(colRef, {
          name: c.name,
          slug: slugify(c.slug),
          imageUrl: c.imageUrl,
          createdAt: serverTimestamp() as any,
          updatedAt: serverTimestamp() as any,
        } satisfies CategoryDoc as any);
      }
      toast.success(`Created ${defaults.length} categories`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to seed categories");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (c: WithId<CategoryDoc>) => {
    const productCount = productCountByCategory.get(c.id) || 0;
    if (productCount > 0) {
      toast.error(`Cannot delete: ${productCount} product(s) are using this category`);
      return;
    }

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
          <p className="text-sm text-muted-foreground">
            Manage product categories ({categories.length} total)
          </p>
        </div>
        <div className="flex gap-2">
          {categories.length === 0 && (
            <Button variant="outline" onClick={seedDefaultCategories} disabled={saving}>
              Seed default categories
            </Button>
          )}
          <Button onClick={openCreate}>Add category</Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Categories Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-center">Products</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCategories.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      {c.imageUrl ? (
                        <img
                          src={c.imageUrl}
                          alt={c.name}
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{c.slug}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {productCountByCategory.get(c.id) || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onDelete(c)}
                        disabled={(productCountByCategory.get(c.id) || 0) > 0}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedCategories.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      No categories found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
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
              {form.imageUrl.trim() && (
                <img
                  src={form.imageUrl.trim()}
                  alt="Preview"
                  className="h-20 w-20 rounded object-cover border mt-2"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
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
