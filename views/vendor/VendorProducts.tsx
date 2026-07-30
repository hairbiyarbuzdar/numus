import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
} from 'lucide-react';
import { Product, ProductApprovalStatus, ProductStatus, ProductType } from '../../types';
import { buildPageList, formatCurrency } from '../../utils/helpers';
import { SkeletonTableRows } from '../../components/Skeleton';
import { useProducts } from '../../context/ProductContext';
import { useAuth } from '../../context/AuthContext';
import { PaginatedProducts, ProductQuery, ProductSort, productApi } from '../../services/productApi';

const STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
];

const APPROVAL_OPTIONS: { value: ProductApprovalStatus; label: string }[] = [
  { value: 'pending', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const TYPE_OPTIONS: { value: ProductType; label: string }[] = [
  { value: 'retail', label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'auction', label: 'Auction' },
];

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title_asc', label: 'Title (A–Z)' },
  { value: 'title_desc', label: 'Title (Z–A)' },
  { value: 'price_asc', label: 'Price (low to high)' },
  { value: 'price_desc', label: 'Price (high to low)' },
  { value: 'stock_asc', label: 'Stock (low to high)' },
  { value: 'stock_desc', label: 'Stock (high to low)' },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const SEARCH_DEBOUNCE_MS = 400;

// Matches the field-label style used elsewhere in the vendor portal
// (see views/vendor/CompleteProfile.tsx).
const LABEL_CLASS = 'mb-1 block text-sm font-medium text-gray-700';

interface Filters {
  status: ProductStatus | 'all';
  approvalStatus: ProductApprovalStatus | 'all';
  productType: ProductType | 'all';
  category: string;
  minPrice: string;
  maxPrice: string;
}

const EMPTY_FILTERS: Filters = {
  status: 'all',
  approvalStatus: 'all',
  productType: 'all',
  category: 'all',
  minPrice: '',
  maxPrice: '',
};

const VendorProducts: React.FC = () => {
  const { addProduct, deleteProduct } = useProducts();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [imagePreview, setImagePreview] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  // ─── Search / filter / pagination state ────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<ProductSort>('newest');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  const [result, setResult] = useState<PaginatedProducts | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    productType: 'retail' as 'retail' | 'wholesale',
    basePrice: '',
    stock: '',
    minOrderQty: '1',
    image: '',
    status: 'active' as ProductStatus,
  });

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
      status: filters.status === 'all' ? undefined : filters.status,
      approvalStatus: filters.approvalStatus === 'all' ? undefined : filters.approvalStatus,
      productType: filters.productType === 'all' ? undefined : filters.productType,
      category: filters.category === 'all' ? undefined : filters.category,
      minPrice: filters.minPrice === '' ? undefined : Number(filters.minPrice),
      maxPrice: filters.maxPrice === '' ? undefined : Number(filters.maxPrice),
      sort,
      page,
      pageSize,
    }),
    [search, filters, sort, page, pageSize]
  );

  // Guards against a slow earlier request overwriting a newer result.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!user?.uid) return;

    const requestId = ++requestIdRef.current;
    setLoading(true);

    productApi
      .listProductsPage(query)
      .then((response) => {
        if (requestId !== requestIdRef.current) return;
        setResult(response);
        setListError(null);
        // The API clamps an out-of-range page (e.g. after the last row on the
        // final page is deleted) — mirror that back into local state.
        if (response.page !== page) setPage(response.page);
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        setResult(null);
        setListError(err instanceof Error ? err.message : 'Failed to load products.');
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [query, refreshKey, user?.uid, page]);

  useEffect(() => {
    if (!user?.uid) return;
    let active = true;
    productApi
      .listFilterOptions()
      .then((response) => {
        if (active) setCategories(response.categories);
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, [user?.uid, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((prev) => prev + 1), []);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const activeFilterCount = useMemo(
    () =>
      (Object.keys(EMPTY_FILTERS) as (keyof Filters)[]).filter(
        (key) => filters[key] !== EMPTY_FILTERS[key]
      ).length,
    [filters]
  );

  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setSearchInput('');
    setSearch('');
    setSort('newest');
    setPage(1);
  };

  const products = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const hasQuery = Boolean(search) || activeFilterCount > 0;

  const getModerationBadge = (product: Product) => {
    if (product.approvalStatus === 'approved') {
      return { label: 'Approved', className: 'bg-emerald-100 text-emerald-700' };
    }
    if (product.approvalStatus === 'rejected') {
      return { label: 'Rejected', className: 'bg-red-100 text-red-700' };
    }
    return { label: 'Pending Approval', className: 'bg-amber-100 text-amber-700' };
  };

  const getStatusBadge = (product: Product) => {
    switch (product.status) {
      case 'active':
        return { label: 'Active', className: 'bg-emerald-100 text-emerald-700' };
      case 'out_of_stock':
        return { label: 'Out of Stock', className: 'bg-orange-100 text-orange-700' };
      case 'inactive':
        return { label: 'Inactive', className: 'bg-gray-100 text-gray-600' };
      case 'archived':
        return { label: 'Archived', className: 'bg-slate-200 text-slate-600' };
      case 'draft':
        return { label: 'Draft', className: 'bg-gray-100 text-gray-600' };
      default:
        return { label: 'Active', className: 'bg-emerald-100 text-emerald-700' };
    }
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Image upload failed.'));
      reader.readAsDataURL(file);
    });

  const handleCreateProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    // The ref (not the state flag) is what blocks a double submit: two clicks in
    // the same tick would both read a stale `isSaving === false`.
    if (savingRef.current) return;

    const imageToUse = imagePreview || form.image;
    if (!imageToUse) {
      alert('Please upload an image or provide an image URL.');
      return;
    }

    savingRef.current = true;
    setIsSaving(true);

    try {
      await addProduct({
        vendorId: user.uid,
        vendorName: user.displayName || 'Farmer',
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        image: imageToUse,
        productType: form.productType,
        basePrice: Number(form.basePrice),
        stock: Number(form.stock),
        minOrderQty: Number(form.minOrderQty),
        status: form.status,
      });

      setForm({
        title: '',
        description: '',
        category: '',
        productType: 'retail',
        basePrice: '',
        stock: '',
        minOrderQty: '1',
        image: '',
        status: 'active',
      });
      setImagePreview('');
      setShowForm(false);
      setPage(1);
      refresh();
      alert(
        form.status === 'draft'
          ? 'Product saved as a draft.'
          : 'Product submitted successfully. It is now waiting for admin approval.'
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit product.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleDelete = async (product: Product) => {
    const confirmed = window.confirm(`Delete "${product.title}"?`);
    if (!confirmed) return;
    try {
      await deleteProduct(product.id);
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete product.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Products</h1>
          <p className="text-sm text-gray-500">
            {loading && !result
              ? 'Loading your inventory…'
              : `${total} product${total === 1 ? '' : 's'}${hasQuery ? ' match your search' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div>
            <label htmlFor="product-title" className={LABEL_CLASS}>
              Product Title <span className="text-red-500">*</span>
            </label>
            <input
              id="product-title"
              required
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Engro Urea (46% Nitrogen) - 50kg"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="product-category" className={LABEL_CLASS}>
              Category <span className="text-red-500">*</span>
            </label>
            <input
              id="product-category"
              required
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              placeholder="e.g. Fertilizers (Khad)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="product-description" className={LABEL_CLASS}>
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="product-description"
              required
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Short description buyers will see on the listing"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[90px]"
            />
          </div>
          <div>
            <label htmlFor="product-type" className={LABEL_CLASS}>Product Type</label>
            <select
              id="product-type"
              value={form.productType}
              onChange={(e) => setForm((prev) => ({ ...prev, productType: e.target.value as 'retail' | 'wholesale' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
            >
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale (MOQ)</option>
            </select>
          </div>
          <div>
            <label htmlFor="product-status" className={LABEL_CLASS}>Publication Status</label>
            <select
              id="product-status"
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ProductStatus }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="product-base-price" className={LABEL_CLASS}>
              Base Price (PKR) <span className="text-red-500">*</span>
            </label>
            <input
              id="product-base-price"
              required
              type="number"
              min={1}
              value={form.basePrice}
              onChange={(e) => setForm((prev) => ({ ...prev, basePrice: e.target.value }))}
              placeholder="e.g. 4500"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="product-stock" className={LABEL_CLASS}>
              Stock (units) <span className="text-red-500">*</span>
            </label>
            <input
              id="product-stock"
              required
              type="number"
              min={1}
              value={form.stock}
              onChange={(e) => setForm((prev) => ({ ...prev, stock: e.target.value }))}
              placeholder="e.g. 120"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="product-moq" className={LABEL_CLASS}>
              Minimum Order Quantity (MOQ) <span className="text-red-500">*</span>
            </label>
            <input
              id="product-moq"
              required
              type="number"
              min={1}
              value={form.minOrderQty}
              onChange={(e) => setForm((prev) => ({ ...prev, minOrderQty: e.target.value }))}
              placeholder="e.g. 1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="product-image-url" className={LABEL_CLASS}>Image URL</label>
            <input
              id="product-image-url"
              value={form.image}
              onChange={(e) => setForm((prev) => ({ ...prev, image: e.target.value }))}
              placeholder="https://... (optional if you upload a file below)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="product-image-file" className={LABEL_CLASS}>Upload Image</label>
            <input
              id="product-image-file"
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const dataUrl = await readFileAsDataUrl(file);
                setImagePreview(dataUrl);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            {imagePreview && (
              <img src={imagePreview} alt="Preview" className="mt-2 w-24 h-24 object-cover rounded-lg border border-gray-200" />
            )}
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              aria-busy={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-emerald-600"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSaving ? 'Saving…' : 'Save Product'}
            </button>
          </div>
        </form>
      )}

      {/* Search + Filters */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 p-4 sm:items-end">
          <div className="flex-1">
            <label htmlFor="product-search" className={LABEL_CLASS}>Search Products</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              <input
                id="product-search"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by title, description or category..."
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              aria-expanded={showFilters}
              className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
                showFilters || activeFilterCount > 0
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="ml-1 rounded-full bg-emerald-600 px-2 text-xs font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <div>
              <label htmlFor="filter-status" className={LABEL_CLASS}>Status</label>
              <select
                id="filter-status"
                value={filters.status}
                onChange={(e) => updateFilter('status', e.target.value as ProductStatus | 'all')}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Status</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="product-sort" className={LABEL_CLASS}>Sort By</label>
              <select
                id="product-sort"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as ProductSort);
                  setPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-gray-200 p-4">
            <div>
              <label htmlFor="filter-approval" className={LABEL_CLASS}>Approval Status</label>
              <select
                id="filter-approval"
                value={filters.approvalStatus}
                onChange={(e) => updateFilter('approvalStatus', e.target.value as ProductApprovalStatus | 'all')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All</option>
                {APPROVAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-type" className={LABEL_CLASS}>Product Type</label>
              <select
                id="filter-type"
                value={filters.productType}
                onChange={(e) => updateFilter('productType', e.target.value as ProductType | 'all')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All</option>
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-category" className={LABEL_CLASS}>Category</label>
              <select
                id="filter-category"
                value={filters.category}
                onChange={(e) => updateFilter('category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <span className={LABEL_CLASS}>Price Range (PKR)</span>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label htmlFor="filter-min-price" className="mb-1 block text-xs text-gray-500">Min</label>
                  <input
                    id="filter-min-price"
                    type="number"
                    min={0}
                    value={filters.minPrice}
                    onChange={(e) => updateFilter('minPrice', e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <span className="pb-2 text-gray-400">–</span>
                <div className="flex-1">
                  <label htmlFor="filter-max-price" className="mb-1 block text-xs text-gray-500">Max</label>
                  <input
                    id="filter-max-price"
                    type="number"
                    min={0}
                    value={filters.maxPrice}
                    onChange={(e) => updateFilter('maxPrice', e.target.value)}
                    placeholder="Any"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
            {hasQuery && (
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
                >
                  Clear search &amp; filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {listError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {listError}
          <button onClick={refresh} className="ml-2 font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {/* Product Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="relative overflow-x-auto">
          {/* Skeleton rows carry the first load; the overlay covers refetches so
              the current rows stay readable while new ones arrive. */}
          {loading && result && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            </div>
          )}
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Price/Bid</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && !result && <SkeletonTableRows rows={pageSize > 10 ? 10 : pageSize} columns={6} label="Loading your products" />}
              {products.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    {hasQuery ? (
                      <>
                        <p className="font-medium text-gray-700">No products match your search.</p>
                        <button
                          type="button"
                          onClick={clearAll}
                          className="mt-2 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                        >
                          Clear search &amp; filters
                        </button>
                      </>
                    ) : (
                      <p className="font-medium text-gray-700">
                        You haven&apos;t added any products yet.
                      </p>
                    )}
                  </td>
                </tr>
              )}
              {products.map((product) => {
                const moderationBadge = getModerationBadge(product);
                const statusBadge = getStatusBadge(product);
                return (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={product.images[0]}
                        alt={product.title}
                        className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{product.title}</p>
                        <p className="text-sm text-gray-500">{product.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`
                      px-2 py-1 text-xs font-semibold rounded-full
                      ${product.productType === 'auction' ? 'bg-purple-100 text-purple-700' :
                        product.productType === 'wholesale' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}
                    `}>
                      {product.productType.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {product.isAuction
                      ? `${formatCurrency(product.currentHighestBid || product.startingPrice || 0)} (Current Bid)`
                      : formatCurrency(product.basePrice || 0)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {product.stock} units
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-semibold ${statusBadge.className}`}>
                        {statusBadge.label}
                      </span>
                      {product.status !== 'draft' && (
                        <span className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-semibold ${moderationBadge.className}`}>
                          {moderationBadge.label}
                        </span>
                      )}
                      {product.approvalStatus === 'rejected' && product.rejectionReason && (
                        <p className="max-w-[220px] text-xs text-red-500">{product.rejectionReason}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => void handleDelete(product)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-200 px-6 py-3">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>
              {total === 0 ? 'No results' : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
            </span>
            <label htmlFor="rows-per-page" className="flex items-center gap-2">
              <span className="font-medium text-gray-700">Rows per page</span>
              <select
                id="rows-per-page"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            {buildPageList(page, totalPages).map((entry, idx) =>
              entry === 'gap' ? (
                <span key={`gap-${idx}`} className="px-2 text-sm text-gray-400">…</span>
              ) : (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setPage(entry)}
                  disabled={loading}
                  aria-current={entry === page ? 'page' : undefined}
                  className={`min-w-[36px] rounded-lg border px-2 py-1.5 text-sm transition-colors disabled:cursor-not-allowed ${
                    entry === page
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-gray-300 hover:bg-gray-50'
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
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorProducts;
