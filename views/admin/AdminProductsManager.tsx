import React, { useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Pencil, Search, Trash2, XCircle } from "lucide-react";
import ConfirmModal from "../../components/ConfirmModal";
import { useProducts } from "../../context/ProductContext";
import { formatCurrency } from "../../utils/helpers";

const AdminProductsManager: React.FC = () => {
  const { products, deleteProduct, setProductActive, approveProduct, rejectProduct, updateProduct } = useProducts();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");

  const categories = Array.from(new Set(products.map((p) => p.category))).sort();
  const vendors = Array.from(new Set(products.map((p) => p.vendorName))).sort();

  const filtered = useMemo(() => {
    return products.filter((product) => {
      const matchesQuery = `${product.title} ${product.vendorName}`.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = category === "all" || product.category === category;
      const matchesVendor = vendorFilter === "all" || product.vendorName === vendorFilter;
      const moderationStatus = product.approvalStatus || "approved";
      const visibilityStatus = product.isActive === false ? "inactive" : "active";
      const matchesStatus =
        statusFilter === "all" || statusFilter === moderationStatus || statusFilter === visibilityStatus;
      return matchesQuery && matchesCategory && matchesVendor && matchesStatus;
    });
  }, [category, products, query, statusFilter, vendorFilter]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-cyan-900 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight">Products Management</h1>
        <p className="mt-2 text-sm text-cyan-100">Search, moderate, edit, and control product visibility across the marketplace.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products"
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm"
            />
          </div>
          <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm">
            <option value="all">All Farmers</option>
            {vendors.map((vendor) => (
              <option key={vendor} value={vendor}>{vendor}</option>
            ))}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm">
            <option value="all">All Categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
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
            {filtered.map((product) => (
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
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${product.isActive === false ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                      {product.isActive === false ? "Hidden" : "Visible"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditTarget(product.id);
                        setEditTitle(product.title);
                        setEditPrice(String(product.basePrice || ""));
                        setEditStock(String(product.stock || ""));
                      }}
                      className="rounded-md border border-gray-300 p-1.5 text-slate-600 hover:bg-slate-50"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        void approveProduct(product.id).catch((err) => {
                          alert(err instanceof Error ? err.message : "Failed to approve product.");
                        });
                      }}
                      className="rounded-md border border-emerald-300 p-1.5 text-emerald-700 hover:bg-emerald-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        void rejectProduct(product.id).catch((err) => {
                          alert(err instanceof Error ? err.message : "Failed to reject product.");
                        });
                      }}
                      className="rounded-md border border-amber-300 p-1.5 text-amber-700 hover:bg-amber-50"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        void setProductActive(product.id, product.isActive === false).catch((err) => {
                          alert(err instanceof Error ? err.message : "Failed to update visibility.");
                        });
                      }}
                      className="rounded-md border border-blue-300 p-1.5 text-blue-700 hover:bg-blue-50"
                    >
                      {product.isActive === false ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button onClick={() => setDeleteTarget(product.id)} className="rounded-md border border-red-300 p-1.5 text-red-700 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No products found.</td>
              </tr>
            )}
          </tbody>
        </table>
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
          void deleteProduct(deleteTarget).catch((err) => {
            alert(err instanceof Error ? err.message : "Failed to delete product.");
          });
          setDeleteTarget(null);
        }}
      />

      {editTarget && (
        <div className="fixed inset-0 z-[94]">
          <button className="absolute inset-0 bg-black/40" onClick={() => setEditTarget(null)} />
          <div className="absolute left-1/2 top-1/2 w-[92%] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Edit Product</h3>
            <div className="mt-4 grid gap-3">
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2" />
              <input value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2" />
              <input value={editStock} onChange={(e) => setEditStock(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditTarget(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Cancel</button>
              <button
                onClick={() => {
                  void updateProduct(editTarget, { title: editTitle, basePrice: Number(editPrice) || 0, stock: Number(editStock) || 0 })
                    .then(() => setEditTarget(null))
                    .catch((err) => {
                      alert(err instanceof Error ? err.message : "Failed to update product.");
                    });
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white"
              >
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
