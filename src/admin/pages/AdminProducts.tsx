import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CategoryDoc, ProductBadge, ProductDoc } from "@/lib/models";
import { slugify } from "@/lib/slug";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Control } from "react-hook-form";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { parseSpecificationsFromText } from "@/lib/specificationPaste";
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

const optionalNumber = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return undefined;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }
  return v;
}, z.number().min(0, "Must be ≥ 0").optional());

const specItemSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(120, "Label is too long"),
  value: z.string().trim().min(1, "Value is required").max(2000, "Value is too long"),
});

const specSectionSchema = z.object({
  title: z.string().trim().min(1, "Section title is required").max(60, "Section title is too long"),
  items: z.array(specItemSchema).min(1, "Add at least 1 specification"),
});

const productFormSchema = z
  .object({
    // Allow long product names (admin may paste longer titles). Firestore also has document size limits,
    // so we keep a very generous max rather than "unlimited".
    name: z.string().trim().min(1, "Name is required").max(2000, "Name is too long"),
    price: z.coerce.number().min(0, "Price must be ≥ 0"),
    compareAtPrice: optionalNumber,
    sku: z.string().trim().max(64, "SKU is too long").optional(),
    brand: z.string().trim().max(64, "Brand is too long").optional(),
    gender: z.enum(["male", "female", "unisex"]).optional(),
    tagsText: z.string().optional().default(""),
    badgesText: z.string().optional().default(""),
    featured: z.boolean().default(false),
    categoryId: z.string().min(1, "Category is required"),
    description: z.string().max(4000, "Description is too long").optional().default(""),
    stock: z.coerce.number().int("Stock must be an integer").min(0, "Stock must be ≥ 0"),
    weightKg: optionalNumber,
    dimensionLengthCm: optionalNumber,
    dimensionWidthCm: optionalNumber,
    dimensionHeightCm: optionalNumber,
    published: z.boolean().default(true),
    imageUrls: z
      .array(z.object({ value: z.string() }))
      .min(1)
      .refine((arr) => arr.some((u) => u.value.trim().length > 0), {
        message: "At least 1 Image URL is required",
      })
      .refine(
        (arr) =>
          arr
            .map((u) => u.value.trim())
            .filter(Boolean)
            .every((u) => {
              try {
                // URL() is strict but good for admin validation
                // eslint-disable-next-line no-new
                new URL(u);
                return true;
              } catch {
                return false;
              }
            }),
        { message: "All Image URLs must be valid URLs" },
      ),
    specifications: z.array(specSectionSchema).optional().default([]),
  })
  .refine(
    (v) => v.compareAtPrice === undefined || v.compareAtPrice >= v.price,
    {
      message: "Compare-at price must be ≥ price",
      path: ["compareAtPrice"],
    },
  );

type ProductFormValues = z.infer<typeof productFormSchema>;

const defaultProductValues: ProductFormValues = {
  name: "",
  price: 0,
  compareAtPrice: undefined,
  sku: "",
  brand: "",
  gender: undefined,
  tagsText: "",
  badgesText: "",
  weightKg: undefined,
  dimensionLengthCm: undefined,
  dimensionWidthCm: undefined,
  dimensionHeightCm: undefined,
  featured: false,
  categoryId: "",
  description: "",
  stock: 10,
  published: true,
  imageUrls: [{ value: "" }],
  specifications: [],
};

const ITEMS_PER_PAGE = 10;

export default function AdminProducts() {
  const [products, setProducts] = useState<Array<WithId<ProductDoc>>>([]);
  const [categories, setCategories] = useState<Array<WithId<CategoryDoc>>>([]);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [editing, setEditing] = useState<WithId<ProductDoc> | null>(null);
  const [specPasteText, setSpecPasteText] = useState("");
  const productForm = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: defaultProductValues,
    mode: "onChange",
  });
  const imageUrlsArray = useFieldArray({
    control: productForm.control,
    name: "imageUrls",
  });

  const specSectionsArray = useFieldArray({
    control: productForm.control,
    name: "specifications",
  });

  const [imagePreviewErrors, setImagePreviewErrors] = useState<Record<number, boolean>>({});

  // Search, filter, and pagination
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStock, setFilterStock] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const hiddenCategorySlugs = useMemo(() => new Set(["electronics"]), []);
  const visibleCategories = useMemo(() => {
    return categories.filter((c) => {
      const slug = slugify(String(c.slug ?? c.name ?? "").trim());
      return !hiddenCategorySlugs.has(slug);
    });
  }, [categories, hiddenCategorySlugs]);

  const selectedCategoryId = useWatch({ control: productForm.control, name: "categoryId" });
  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === selectedCategoryId) ?? null;
  }, [categories, selectedCategoryId]);

  const categoryOptionsForForm = useMemo(() => {
    const opts = [...visibleCategories];
    if (selectedCategory && !opts.some((c) => c.id === selectedCategory.id)) {
      opts.unshift(selectedCategory);
    }
    return opts;
  }, [visibleCategories, selectedCategory]);

  const hasSocksCategory = useMemo(() => {
    return categories.some((c) => slugify(String(c.slug ?? c.name ?? "").trim()) === "socks");
  }, [categories]);

  const createSocksCategory = async () => {
    if (hasSocksCategory) {
      toast.success("Socks category already exists");
      return;
    }
    setCreatingCategory(true);
    try {
      await addDoc(collection(db, "categories"), {
        name: "Socks",
        slug: "socks",
        imageUrl: "https://placehold.co/600x600/png?text=Socks",
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
      } satisfies CategoryDoc as any);
      toast.success("Created Socks category");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create Socks category");
    } finally {
      setCreatingCategory(false);
    }
  };

  useEffect(() => {
    const unsubProducts = onSnapshot(
      collection(db, "products"),
      (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProductDoc) })));
      },
      (err) => {
        console.error("Firestore subscription failed (products):", err);
      }
    );
    const unsubCategories = onSnapshot(
      collection(db, "categories"),
      (snap) => {
        setCategories(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CategoryDoc) })));
      },
      (err) => {
        console.error("Firestore subscription failed (categories):", err);
      }
    );

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

  useEffect(() => {
    if (filterCategory === "all") return;
    if (!visibleCategories.some((c) => c.id === filterCategory)) {
      setFilterCategory("all");
    }
  }, [filterCategory, visibleCategories]);

  const resetDialog = () => {
    setEditing(null);
    productForm.reset(defaultProductValues);
    setImagePreviewErrors({});
    setSpecPasteText("");
  };

  const openCreate = () => {
    resetDialog();
    setOpen(true);
  };

  const openEdit = (p: WithId<ProductDoc>) => {
    setEditing(p);
    productForm.reset({
      name: p.name ?? "",
      price: Number(p.price ?? 0),
      compareAtPrice: typeof p.compareAtPrice === "number" ? p.compareAtPrice : undefined,
      sku: p.sku ?? "",
      brand: p.brand ?? "",
      gender: typeof p.gender === "string" ? p.gender : undefined,
      tagsText: Array.isArray(p.tags) ? p.tags.join(", ") : "",
      badgesText: Array.isArray(p.badges) ? p.badges.join(", ") : "",
      weightKg: typeof p.weightKg === "number" ? p.weightKg : undefined,
      dimensionLengthCm: typeof p.dimensionsCm?.length === "number" ? p.dimensionsCm.length : undefined,
      dimensionWidthCm: typeof p.dimensionsCm?.width === "number" ? p.dimensionsCm.width : undefined,
      dimensionHeightCm: typeof p.dimensionsCm?.height === "number" ? p.dimensionsCm.height : undefined,
      featured: Boolean(p.featured),
      categoryId: p.categoryId ?? "",
      description: p.description ?? "",
      stock: Number(p.stock ?? 0),
      published: Boolean(p.published),
      imageUrls: Array.isArray(p.imageUrls) && p.imageUrls.length ? p.imageUrls.map((url: string) => ({ value: url })) : [{ value: "" }],
      specifications: Array.isArray(p.specifications) ? p.specifications : [],
    });
    setImagePreviewErrors({});
    setOpen(true);
  };

  const parseTags = (tagsText: string | undefined) => {
    const raw = (tagsText ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    return Array.from(new Set(raw));
  };

  const parseBadges = (badgesText: string | undefined): ProductBadge[] => {
    const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const raw = (badgesText ?? "")
      .split(",")
      .map((t) => normalize(t))
      .filter(Boolean);

    const mapToCanonical = (value: string): ProductBadge | null => {
      const compact = value.replace(/[\s_-]+/g, "");
      switch (compact) {
        case "bestseller":
        case "bestsellers":
        case "bestselling":
          return "bestseller";
        case "trending":
        case "trend":
          return "trending";
        case "new":
        case "newarrival":
        case "newarrivals":
          return "new";
        case "hot":
          return "hot";
        case "limited":
        case "limitededition":
          return "limited";
        case "exclusive":
          return "exclusive";
        case "sale":
        case "onsale":
          return "sale";
        default:
          return null;
      }
    };

    const canonical = raw.map(mapToCanonical).filter((b): b is ProductBadge => Boolean(b));
    return Array.from(new Set(canonical));
  };

  const onSubmit = productForm.handleSubmit(async (values) => {
    const cat = categoryById.get(values.categoryId);
    if (!cat) {
      toast.error("Selected category not found");
      return;
    }

    const urls = values.imageUrls.map((u) => (u.value ?? "").trim()).filter(Boolean);
    const tags = parseTags(values.tagsText);
    const badges = parseBadges(values.badgesText);
    const cleanedSpecs = (values.specifications ?? [])
      .map((s) => {
        const title = (s.title ?? "").trim();
        const items = (s.items ?? [])
          .map((it) => ({
            label: (it.label ?? "").trim(),
            value: (it.value ?? "").trim(),
          }))
          .filter((it) => it.label && it.value);
        return { title, items };
      })
      .filter((s) => s.title && s.items.length);

    const payload: any = {
      name: values.name.trim(),
      price: values.price,
      categoryId: cat.id,
      categorySlug: cat.slug,
      description: (values.description ?? "").trim(),
      stock: values.stock,
      imageUrls: urls,
      published: values.published,
      updatedAt: serverTimestamp(),
    };

    // Only add optional fields if they have values (Firestore doesn't allow undefined)
    if (values.compareAtPrice !== undefined) payload.compareAtPrice = values.compareAtPrice;
    if (values.sku?.trim()) payload.sku = values.sku.trim();
    if (values.brand?.trim()) payload.brand = values.brand.trim();
    if (values.gender) payload.gender = values.gender;
    else if (editing) payload.gender = deleteField();
    if (tags.length) payload.tags = tags;
    if (badges.length) payload.badges = badges;
    else if (editing) payload.badges = deleteField();
    if (values.weightKg !== undefined) payload.weightKg = values.weightKg;
    if (
      values.dimensionLengthCm !== undefined ||
      values.dimensionWidthCm !== undefined ||
      values.dimensionHeightCm !== undefined
    ) {
      payload.dimensionsCm = {
        ...(values.dimensionLengthCm !== undefined && { length: values.dimensionLengthCm }),
        ...(values.dimensionWidthCm !== undefined && { width: values.dimensionWidthCm }),
        ...(values.dimensionHeightCm !== undefined && { height: values.dimensionHeightCm }),
      };
    }
    if (values.featured) payload.featured = values.featured;

    if (cleanedSpecs.length) payload.specifications = cleanedSpecs;
    else if (editing) payload.specifications = deleteField();

    setSaving(true);
    try {
      if (editing) {
        const ref = doc(db, "products", editing.id);
        await updateDoc(ref, payload);
        toast.success("Product updated");
      } else {
        payload.createdAt = serverTimestamp();
        const ref = collection(db, "products");
        await addDoc(ref, payload);
        toast.success("Product created");
      }
      setOpen(false);
      resetDialog();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save product");
    } finally {
      setSaving(false);
    }
  });

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

  const addImageUrlField = () => {
    imageUrlsArray.append({ value: "" });
  };

  const addSpecSection = () => {
    specSectionsArray.append({ title: "", items: [{ label: "", value: "" }] });
  };

  const addSpecTemplate = () => {
    specSectionsArray.append({
      title: "In The Box",
      items: [
        { label: "Pack of", value: "" },
        { label: "Sales Package", value: "" },
      ],
    });
    specSectionsArray.append({
      title: "General",
      items: [
        { label: "Brand", value: "" },
        { label: "Model Name", value: "" },
      ],
    });
  };

  const applyPastedSpecs = (mode: "append" | "replace") => {
    const parsed = parseSpecificationsFromText(specPasteText);
    if (!parsed.length) {
      toast.error("No valid specification lines found. Add one per line, e.g. 'Net Quantity1.0 Count'.");
      return;
    }

    const section = { title: "General", items: parsed };
    if (mode === "replace") {
      specSectionsArray.replace([section]);
    } else {
      specSectionsArray.append(section);
    }

    toast.success(mode === "replace" ? "Specifications replaced" : "Specifications added");
  };

  const removeImageUrlField = (idx: number) => {
    imageUrlsArray.remove(idx);
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

  const SpecSectionEditor = ({
    control,
    sectionIndex,
    onRemove,
  }: {
    control: Control<ProductFormValues>;
    sectionIndex: number;
    onRemove: () => void;
  }) => {
    const itemsArray = useFieldArray({
      control,
      name: `specifications.${sectionIndex}.items` as const,
    });

    return (
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <FormField
            control={control}
            name={`specifications.${sectionIndex}.title` as const}
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Section title</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. General" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="button" variant="outline" onClick={onRemove}>
            Remove section
          </Button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Rows</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => itemsArray.append({ label: "", value: "" })}
            >
              Add row
            </Button>
          </div>

          {itemsArray.fields.map((row, rowIdx) => (
            <div key={row.id} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
              <FormField
                control={control}
                name={`specifications.${sectionIndex}.items.${rowIdx}.label` as const}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sm:sr-only">Label</FormLabel>
                    <FormControl>
                      <Input placeholder="Label (e.g. Brand)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name={`specifications.${sectionIndex}.items.${rowIdx}.value` as const}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sm:sr-only">Value</FormLabel>
                    <FormControl>
                      <Input placeholder="Value (e.g. Iba)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="button"
                variant="outline"
                onClick={() => itemsArray.remove(rowIdx)}
                disabled={itemsArray.fields.length === 1}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
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
                {visibleCategories.map((c) => (
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

          <Form {...productForm}>
            <form onSubmit={onSubmit} className="grid gap-6">
              <div className="grid gap-4">
                <FormField
                  control={productForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. TrendMix Hoodie" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={productForm.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price (₹)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={productForm.control}
                    name="compareAtPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Compare at price (₹) (optional)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step="0.01" placeholder="e.g. 999" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={productForm.control}
                    name="stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stock quantity</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={productForm.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categoryOptionsForForm.length > 0 ? (
                              categoryOptionsForForm.map((c) => {
                                const slug = slugify(String(c.slug ?? c.name ?? "").trim());
                                const label = hiddenCategorySlugs.has(slug) ? `${c.name} (deprecated)` : c.name;
                                return (
                                  <SelectItem key={c.id} value={c.id}>
                                    {label}
                                  </SelectItem>
                                );
                              })
                            ) : (
                              <SelectItem value="__no_categories__" disabled>
                                No categories found
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                        {categoryOptionsForForm.length === 0 && (
                          <p className="text-xs text-muted-foreground">Create a category first.</p>
                        )}
                        {!hasSocksCategory && (
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-muted-foreground">Missing “Socks”? Create it now.</p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={createSocksCategory}
                              disabled={creatingCategory}
                            >
                              {creatingCategory ? "Creating…" : "Create Socks"}
                            </Button>
                          </div>
                        )}
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={productForm.control}
                    name="sku"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SKU (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. TM-HOODIE-BLK-M" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={productForm.control}
                    name="brand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Brand (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. TrendMix" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={productForm.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender (optional)</FormLabel>
                      <Select
                        value={field.value ?? "unspecified"}
                        onValueChange={(value) => field.onChange(value === "unspecified" ? undefined : value)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unspecified">Not specified</SelectItem>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="unisex">Unisex</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={productForm.control}
                  name="tagsText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags (comma separated) (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="summer, sale, cotton" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={productForm.control}
                  name="badgesText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Badges (comma separated) (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="bestseller, trending, new" {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Allowed: bestseller, trending, new, hot, limited, exclusive, sale
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={productForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea rows={4} placeholder="Write a short description..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-sm font-medium">Specifications (optional)</p>
                      <p className="text-xs text-muted-foreground">
                        Add sections and rows (label/value). This shows on the product page like your screenshot.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={addSpecTemplate}>
                        Add template
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={addSpecSection}>
                        Add section
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border p-3 space-y-2">
                    <Label>Quick paste (auto-splits into label/value)</Label>
                    <Textarea
                      rows={5}
                      placeholder={
                        "Paste one per line, e.g.\nManufacturer207, Ground Floor...\nPackerSalty E-Commerce Pvt. Ltd...\nNet Quantity1.0 Count"
                      }
                      value={specPasteText}
                      onChange={(e) => setSpecPasteText(e.target.value)}
                    />
                    <div className="flex gap-2 flex-wrap">
                      <Button type="button" variant="outline" size="sm" onClick={() => applyPastedSpecs("append")}>
                        Add from paste
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => applyPastedSpecs("replace")}>
                        Replace with paste
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tip: Works with formats like “Key: Value”, “Key25 g”, or “KeyValue” (camel-case).
                    </p>
                  </div>

                  {specSectionsArray.fields.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No specifications added.</p>
                  ) : (
                    <div className="space-y-3">
                      {specSectionsArray.fields.map((section, idx) => (
                        <SpecSectionEditor
                          key={section.id}
                          control={productForm.control}
                          sectionIndex={idx}
                          onRemove={() => specSectionsArray.remove(idx)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={productForm.control}
                    name="weightKg"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight (kg) (optional)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step="0.01" placeholder="e.g. 0.5" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={productForm.control}
                    name="featured"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-md border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Featured</FormLabel>
                          <p className="text-xs text-muted-foreground">Show as featured (optional).</p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-2">
                  <p className="text-sm font-medium">Dimensions (cm) (optional)</p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField
                      control={productForm.control}
                      name="dimensionLengthCm"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input type="number" min={0} step="0.01" placeholder="Length" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={productForm.control}
                      name="dimensionWidthCm"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input type="number" min={0} step="0.01" placeholder="Width" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={productForm.control}
                      name="dimensionHeightCm"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input type="number" min={0} step="0.01" placeholder="Height" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <FormField
                  control={productForm.control}
                  name="published"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Published</FormLabel>
                        <p className="text-xs text-muted-foreground">Visible in the store.</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Image URLs</p>
                    <Button type="button" variant="outline" size="sm" onClick={addImageUrlField}>
                      Add URL
                    </Button>
                  </div>

                  <FormMessage>{productForm.formState.errors.imageUrls?.message as any}</FormMessage>

                  <div className="space-y-3">
                    {imageUrlsArray.fields.map((f, idx) => (
                      <FormField
                        key={f.id}
                        control={productForm.control}
                        name={`imageUrls.${idx}.value`}
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex gap-2">
                              <FormControl>
                                <Input
                                  placeholder="https://..."
                                  {...field}
                                  value={field.value ?? ""}
                                  onChange={(e) => {
                                    field.onChange(e.target.value);
                                    setImagePreviewErrors((prev) => {
                                      if (!(idx in prev)) return prev;
                                      const next = { ...prev };
                                      delete next[idx];
                                      return next;
                                    });
                                  }}
                                />
                              </FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => removeImageUrlField(idx)}
                                disabled={imageUrlsArray.fields.length === 1}
                              >
                                Remove
                              </Button>
                            </div>

                            {String(field.value ?? "").trim() && !imagePreviewErrors[idx] && (
                              <img
                                src={String(field.value ?? "").trim()}
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
                            {String(field.value ?? "").trim() && imagePreviewErrors[idx] && (
                              <p className="text-xs text-muted-foreground">Preview failed to load. Check the URL.</p>
                            )}

                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
