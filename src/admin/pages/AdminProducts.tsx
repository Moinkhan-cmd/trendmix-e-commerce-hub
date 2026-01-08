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
import { Badge } from "@/components/ui/badge";
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
import { Search, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";

type WithId<T> = T & { id: string };

const emptyForm = {
  name: "",
  price: "",
  categoryId: "",
  description: "",
  stock: "10",
  published: true,
  imageUrls: [""],
};

const ITEMS_PER_PAGE = 10;

export default function AdminProducts() {
  const [products, setProducts] = useState<Array<WithId<ProductDoc>>>([]);
  const [categories, setCategories] = useState<Array<WithId<CategoryDoc>>>([]);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<WithId<ProductDoc> | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const [imagePreviewErrors, setImagePreviewErrors] = useState<Record<number, boolean>>({});

  // Search, filter, and pagination
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStock, setFilterStock] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

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

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = filterCategory === "all" || p.categoryId === filterCategory;
      const matchesStock =
        filterStock === "all" ||
        (filterStock === "low" && (p.stock ?? 0) <= 5) ||
        (filterStock === "out" && (p.stock ?? 0) === 0) ||
        (filterStock === "in" && (p.stock ?? 0) > 0);
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, search, filterCategory, filterStock]);

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterCategory, filterStock]);

  const resetDialog = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setImagePreviewErrors({});
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
      stock: String(p.stock ?? 0),
      published: Boolean(p.published),
      imageUrls: Array.isArray(p.imageUrls) && p.imageUrls.length ? p.imageUrls : [""],
    });
    setImagePreviewErrors({});
    setOpen(true);
  };

  const validate = () => {
    if (!form.name.trim()) return "Product name is required";
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) return "Price must be a valid number";
    const stock = Number(form.stock);
    if (!Number.isFinite(stock) || stock < 0) return "Stock must be a valid number";
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
    const stock = Number(form.stock);
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
    setImagePreviewErrors((prev) => {
      if (!(idx in prev)) return prev;
      const next = { ...prev };
      delete next[idx];
      return next;
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
    setImagePreviewErrors((prev) => {
      const next: Record<number, boolean> = {};
      for (const [k, v] of Object.entries(prev)) {
        const i = Number(k);
        if (Number.isNaN(i) || i === idx) continue;
        next[i > idx ? i - 1 : i] = v;
      }
      return next;
    });
  };

  const getStockBadge = (stock: number) => {
    if (stock === 0) return <Badge variant="destructive">Out of stock</Badge>;
    if (stock <= 5) return <Badge variant="secondary" className="bg-amber-100 text-amber-700">Low: {stock}</Badge>;
    return <Badge variant="outline">{stock}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground">
            Manage your product catalog ({filteredProducts.length} products)
          </p>
        </div>
        <Button onClick={openCreate}>Add product</Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStock} onValueChange={setFilterStock}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Stock" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="in">In Stock</SelectItem>
                <SelectItem value="low">Low Stock (≤5)</SelectItem>
                <SelectItem value="out">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead className="text-center">Published</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProducts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.imageUrls?.[0] ? (
                        <img
                          src={p.imageUrls[0]}
                          alt={p.name}
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{categoryById.get(p.categoryId)?.name || p.categorySlug}</TableCell>
                    <TableCell className="text-right">₹{Number(p.price ?? 0).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-center">{getStockBadge(p.stock ?? 0)}</TableCell>
                    <TableCell className="text-center">
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
                {paginatedProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      No products found.
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
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
            <DialogDescription>
              Fill in the product details below.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="price">Price (₹)</Label>
                <Input id="price" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stock">Stock Quantity</Label>
                <Input id="stock" type="number" min="0" value={form.stock} onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))} />
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
                <p className="text-xs text-muted-foreground">Create a category first.</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>

            <div className="flex items-center justify-between">
              <Label>Published</Label>
              <Switch checked={form.published} onCheckedChange={(v) => setForm((p) => ({ ...p, published: v }))} />
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <Label>Image URLs</Label>
                <Button type="button" variant="outline" size="sm" onClick={addImageUrlField}>
                  Add URL
                </Button>
              </div>
              <div className="space-y-3">
                {form.imageUrls.map((url, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex gap-2">
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
                    {url.trim() && !imagePreviewErrors[idx] && (
                      <img
                        src={url.trim()}
                        alt={`Preview ${idx + 1}`}
                        className="h-20 w-20 rounded object-cover border"
                        onError={() =>
                          setImagePreviewErrors((prev) => ({
                            ...prev,
                            [idx]: true,
                          }))
                        }
                      />
                    )}
                    {url.trim() && imagePreviewErrors[idx] && (
                      <p className="text-xs text-muted-foreground">Preview failed to load. Check the URL.</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
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
