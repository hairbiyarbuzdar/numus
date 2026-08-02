import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import ConfirmModal from "../../components/ConfirmModal";
import { useProducts } from "../../context/ProductContext";
import { buildPageList, formatCurrency } from "../../utils/helpers";
import { SkeletonTableRows } from "../../components/Skeleton";
import { Product, ProductApprovalStatus, ProductStatus } from "../../types";
import {
  PaginatedProducts,
  ProductFilterOptions,
  ProductQuery,
  ProductSort,
  productApi,
} from "../../services/productApi";

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const SEARCH_DEBOUNCE_MS = 400;

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title_asc", label: "Title (A–Z)" },
  { value: "title_desc", label: "Title (Z–A)" },
  { value: "price_asc", label: "Price (low to high)" },
  { value: "price_desc", label: "Price (high to low)" },
  { value: "stock_asc", label: "Stock (low to high)" },
  { value: "stock_desc", label: "Stock (high to low)" },
];

const CONTROL_CLASS = "rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500";

interface Filters {
  vendorId: string;
  category: string;
  approvalStatus: ProductApprovalStatus | "all";
  status: ProductStatus | "all";
  visibility: "all" | "visible" | "hidden";
}

const EMPTY_FILTERS: Filters = {
  vendorId: "all",
  category: "all",
  approvalStatus: "all",
  status: "all",
  visibility: "all",
};

const AdminProductsManager: React.FC = () => {
  // Only the actions come from the context — rows are paged from the API.
  const { deleteProduct, setProductActive, approveProduct, rejectProduct, updateProduct } = useProducts();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<ProductSort>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  const [result, setResult] = useState<PaginatedProducts | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [options, setOptions] = useState<ProductFilterOptions>({ categories: [], vendors: [] });
  const [refreshKey, setRefreshKey] = useState(0);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const actingRef = useRef<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");
  const [saving, setSaving] = useState(false);

  // Debounce typing so we don't fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const query = useMemo<ProductQuery>(
    () => ({
      search: search || undefined,
      vendorId: filters.vendorId === "all" ? undefined : filters.vendorId,
      category: filters.category === "all" ? undefined : filters.category,
      approvalStatus: filters.approvalStatus === "all" ? undefined : filters.approvalStatus,
      status: filters.status === "all" ? undefined : filters.status,
      isActive: filters.visibility === "all" ? undefined : filters.visibility === "visible",
      sort,
      page,
      pageSize,
    }),
    [filters, page, pageSize, search, sort]
  );

  // Guards against a slow earlier request overwriting a newer result.
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);

    productApi
      .listProductsPage(query)
      .then((response) => {
        if (requestId !== requestIdRef.current) return;
        setResult(response);
        setListError(null);
        if (response.page !== page) setPage(response.page);
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        setResult(null);
        setListError(err instanceof Error ? err.message : "Failed to load products.");
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [query, page, refreshKey]);

  useEffect(() => {
    let active = true;
    productApi
      .listFilterOptions()
      .then((response) => {
        if (active) setOptions(response);
      })
      .catch(() => {
        if (active) setOptions({ categories: [], vendors: [] });
      });
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(() => setRefreshKey((prev) => prev + 1), []);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setSearchInput("");
    setSearch("");
    setSort("newest");
    setPage(1);
  };

  const products = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const hasQuery =
    Boolean(search) || (Object.keys(EMPTY_FILTERS) as (keyof Filters)[]).some((key) => filters[key] !== EMPTY_FILTERS[key]);

  /** One request per click, and the row's buttons stay disabled until it lands. */
  const runAction = async (productId: string, action: () => Promise<unknown>, failure: string) => {
    if (actingRef.current) return;
    actingRef.current = productId;
    setActingOn(productId);
    try {
      await action();
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : failure);
    } finally {
      actingRef.current = null;
      setActingOn(null);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-cyan-900 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight">Products Management</h1>
        <p className="mt-2 text-sm text-cyan-100">Search, moderate, edit, and control product visibility across the marketplace.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <label htmlFor="admin-product-search" className="sr-only">Search products</label>
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
            <input
              id="admin-product-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Title, vendor, category or ID"
              className={`${CONTROL_CLASS} w-full pl-9`}
            />
          </div>

          <select
            aria-label="Filter by farmer"
            value={filters.vendorId}
            onChange={(e) => updateFilter("vendorId", e.target.value)}
            className={CONTROL_CLASS}
          >
            <option value="all">All Farmers</option>
            {options.vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
            ))}
          </select>

          <select
            aria-label="Filter by category"
            value={filters.category}
            onChange={(e) => updateFilter("category", e.target.value)}
            className={CONTROL_CLASS}
          >
            <option value="all">All Categories</option>
            {options.categories.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          {/* Approval, publication status and visibility are three separate
              things; one dropdown could not express them, so the old combined
              filter silently ignored whichever the row did not match. */}
          <select
            aria-label="Filter by approval"
            value={filters.approvalStatus}
            onChange={(e) => updateFilter("approvalStatus", e.target.value as Filters["approvalStatus"])}
            className={CONTROL_CLASS}
          >
            <option value="all">All Approvals</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            aria-label="Filter by status"
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value as Filters["status"])}
            className={CONTROL_CLASS}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="out_of_stock">Out of Stock</option>
            <option value="draft">Draft</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>

          <select
            aria-label="Filter by visibility"
            value={filters.visibility}
            onChange={(e) => updateFilter("visibility", e.target.value as Filters["visibility"])}
            className={CONTROL_CLASS}
          >
            <option value="all">All Visibility</option>
            <option value="visible">Visible</option>
            <option value="hidden">Hidden</option>
          </select>

          <select
            aria-label="Sort products"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as ProductSort);
              setPage(1);
            }}
            className={CONTROL_CLASS}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          {hasQuery && (
            <button type="button" onClick={clearAll} className="text-sm font-medium text-cyan-700 hover:text-cyan-800">
              Clear search &amp; filters
            </button>
          )}
        </div>
      </section>

      {listError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {listError}
          <button onClick={refresh} className="ml-2 font-semibold underline">Retry</button>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative overflow-x-auto">
          {loading && result && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
            </div>
          )}
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Product</th>
                <th className="px-4 py-3 text-left font-semibold">Price</th>
                <th className="px-4 py-3 text-left font-semibold">Stock</th>
                <th className="px-4 py-3 text-left font-semibold">Farmer</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && !result && <SkeletonTableRows rows={5} columns={6} label="Loading products" />}

              {products.map((product: Product) => {
                const busy = actingOn === product.id;
                const hidden = product.isActive === false;
                return (
                  <tr key={product.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={product.images[0]} alt={product.title} className="h-12 w-12 rounded-lg object-cover" />
                        <div>
                          <p className="font-semibold text-slate-800">{product.title}</p>
                          <p className="text-xs text-slate-500">{product.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{formatCurrency(product.basePrice || product.currentHighestBid || 0)}</td>
                    <td className="px-4 py-3">{product.stock ?? "-"}</td>
                    <td className="px-4 py-3">{product.vendorName}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          product.approvalStatus === "pending"
                            ? "bg-amber-100 text-amber-700"
                            : product.approvalStatus === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {product.approvalStatus === "pending"
                            ? "Pending"
                            : product.approvalStatus === "rejected"
                            ? "Rejected"
                            : "Approved"}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${hidden ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                          {hidden ? "Hidden" : "Visible"}
                        </span>
                        {product.status && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            product.status === "draft"
                              ? "bg-gray-100 text-gray-600"
                              : product.status === "out_of_stock"
                              ? "bg-orange-100 text-orange-700"
                              : product.status === "inactive"
                              ? "bg-gray-100 text-gray-600"
                              : product.status === "archived"
                              ? "bg-slate-200 text-slate-600"
                              : "bg-emerald-100 text-emerald-700"
                          }`}>
                            {product.status === "out_of_stock" ? "Out of Stock" : product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {/* Every icon carries a title and an aria-label — the icons
                          alone gave no clue what they did. */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditTarget(product.id);
                            setEditTitle(product.title);
                            setEditPrice(String(product.basePrice || ""));
                            setEditStock(String(product.stock || ""));
                          }}
                          disabled={busy}
                          title="Edit product"
                          aria-label={`Edit ${product.title}`}
                          className="rounded-md border border-gray-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => void runAction(product.id, () => approveProduct(product.id), "Failed to approve product.")}
                          disabled={busy || product.approvalStatus === "approved"}
                          title={product.approvalStatus === "approved" ? "Already approved" : "Approve product"}
                          aria-label={`Approve ${product.title}`}
                          className="rounded-md border border-emerald-300 p-1.5 text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => void runAction(product.id, () => rejectProduct(product.id), "Failed to reject product.")}
                          disabled={busy || product.approvalStatus === "rejected"}
                          title={product.approvalStatus === "rejected" ? "Already rejected" : "Reject product"}
                          aria-label={`Reject ${product.title}`}
                          className="rounded-md border border-amber-300 p-1.5 text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => void runAction(product.id, () => setProductActive(product.id, hidden), "Failed to update visibility.")}
                          disabled={busy}
                          title={hidden ? "Show in marketplace" : "Hide from marketplace"}
                          aria-label={hidden ? `Show ${product.title} in the marketplace` : `Hide ${product.title} from the marketplace`}
                          className="rounded-md border border-blue-300 p-1.5 text-blue-700 hover:bg-blue-50 disabled:opacity-40"
                        >
                          {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(product.id)}
                          disabled={busy}
                          title="Delete product"
                          aria-label={`Delete ${product.title}`}
                          className="rounded-md border border-red-300 p-1.5 text-red-700 hover:bg-red-50 disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && products.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    {hasQuery ? (
                      <>
                        <p className="font-medium text-slate-700">No products match your search.</p>
                        <button type="button" onClick={clearAll} className="mt-2 text-sm font-medium text-cyan-700 hover:text-cyan-800">
                          Clear search &amp; filters
                        </button>
                      </>
                    ) : (
                      <p className="font-medium text-slate-700">No products yet.</p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>{total === 0 ? "No results" : `Showing ${rangeStart}–${rangeEnd} of ${total}`}</span>
            <label htmlFor="admin-products-page-size" className="flex items-center gap-2">
              <span className="font-medium text-slate-700">Rows per page</span>
              <select
                id="admin-products-page-size"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page <= 1 || loading}
              aria-label="Previous page"
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            {buildPageList(page, totalPages).map((entry, idx) =>
              entry === "gap" ? (
                <span key={`gap-${idx}`} className="px-2 text-sm text-gray-400">…</span>
              ) : (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setPage(entry)}
                  disabled={loading}
                  aria-current={entry === page ? "page" : undefined}
                  className={`min-w-[36px] rounded-lg border px-2 py-1.5 text-sm ${
                    entry === page ? "border-cyan-600 bg-cyan-600 text-white" : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {entry}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={page >= totalPages || loading}
              aria-label="Next page"
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Product"
        message="Delete this product permanently?"
        destructive
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          const target = deleteTarget;
          setDeleteTarget(null);
          void runAction(target, () => deleteProduct(target), "Failed to delete product.");
        }}
      />

      {editTarget && (
        <div className="fixed inset-0 z-[94]">
          <button className="absolute inset-0 bg-black/40" aria-label="Close" onClick={() => setEditTarget(null)} />
          <div className="absolute left-1/2 top-1/2 w-[92%] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Edit Product</h3>
            <div className="mt-4 grid gap-3">
              <div>
                <label htmlFor="edit-title" className="mb-1 block text-sm font-medium text-gray-700">Title</label>
                <input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label htmlFor="edit-price" className="mb-1 block text-sm font-medium text-gray-700">Price (PKR)</label>
                <input id="edit-price" type="number" min={0} value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label htmlFor="edit-stock" className="mb-1 block text-sm font-medium text-gray-700">Stock</label>
                <input id="edit-stock" type="number" min={0} value={editStock} onChange={(e) => setEditStock(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditTarget(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Cancel</button>
              <button
                disabled={saving}
                onClick={() => {
                  if (saving) return;
                  setSaving(true);
                  void updateProduct(editTarget, {
                    title: editTitle,
                    basePrice: Number(editPrice) || 0,
                    stock: Number(editStock) || 0,
                  })
                    .then(() => {
                      setEditTarget(null);
                      refresh();
                    })
                    .catch((err) => {
                      alert(err instanceof Error ? err.message : "Failed to update product.");
                    })
                    .finally(() => setSaving(false));
                }}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProductsManager;
