import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  PackageSearch,
  Search,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useOrders } from "../../context/OrdersContext";
import { buildPageList, formatCurrency, formatDateTime } from "../../utils/helpers";
import { SkeletonTableRows } from "../../components/Skeleton";
import Modal from "../../components/Modal";
import {
  OrderQuery,
  OrderRecord,
  OrderSort,
  OrderStatus,
  PaginatedOrders,
  orderApi,
} from "../../services/orderApi";

const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  "Pending",
  "Confirmed",
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
];

const SORT_OPTIONS: { value: OrderSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "total_desc", label: "Value (high to low)" },
  { value: "total_asc", label: "Value (low to high)" },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const SEARCH_DEBOUNCE_MS = 400;

const LABEL_CLASS = "mb-1 block text-sm font-medium text-gray-700";
const CONTROL_CLASS =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

const statusClass = (status: OrderStatus) => {
  if (status === "Pending" || status === "Confirmed") return "bg-amber-100 text-amber-700";
  if (status === "Processing" || status === "Shipped") return "bg-blue-100 text-blue-700";
  if (status === "Delivered") return "bg-emerald-100 text-emerald-700";
  if (status === "Cancelled") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
};

interface Filters {
  status: OrderStatus | "all";
  source: "all" | "checkout" | "auction";
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: Filters = { status: "all", source: "all", dateFrom: "", dateTo: "" };

const startOfDay = (value: string) => (value ? new Date(`${value}T00:00:00`).getTime() : undefined);
const endOfDay = (value: string) => (value ? new Date(`${value}T23:59:59.999`).getTime() : undefined);

const VendorOrders: React.FC = () => {
  const { user } = useAuth();
  const { updateOrderStatus, refreshOrders } = useOrders();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<OrderSort>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  const [result, setResult] = useState<PaginatedOrders | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [detailsOrder, setDetailsOrder] = useState<OrderRecord | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Debounce typing so we don't fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const query = useMemo<OrderQuery>(
    () => ({
      search: search || undefined,
      status: filters.status === "all" ? undefined : filters.status,
      source: filters.source === "all" ? undefined : filters.source,
      dateFrom: startOfDay(filters.dateFrom),
      dateTo: endOfDay(filters.dateTo),
      sort,
      page,
      pageSize,
    }),
    [filters, page, pageSize, search, sort]
  );

  // Guards against a slow earlier request overwriting a newer result.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!user?.uid) return;

    const requestId = ++requestIdRef.current;
    setLoading(true);

    // The API scopes this to orders containing this vendor's items.
    orderApi
      .listOrdersPage(query)
      .then((response) => {
        if (requestId !== requestIdRef.current) return;
        setResult(response);
        setListError(null);
        if (response.page !== page) setPage(response.page);
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        setResult(null);
        setListError(err instanceof Error ? err.message : "Failed to load orders.");
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [query, refreshKey, user?.uid, page]);

  const refresh = useCallback(() => setRefreshKey((prev) => prev + 1), []);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const activeFilterCount = useMemo(
    () => (Object.keys(EMPTY_FILTERS) as (keyof Filters)[]).filter((key) => filters[key] !== EMPTY_FILTERS[key]).length,
    [filters]
  );

  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setSearchInput("");
    setSearch("");
    setSort("newest");
    setPage(1);
  };

  const orders = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const hasQuery = Boolean(search) || activeFilterCount > 0;

  /** Only this vendor's lines count toward what they are owed for an order. */
  const vendorItems = useCallback(
    (order: OrderRecord) => order.items.filter((item) => item.vendorId === user?.uid),
    [user?.uid]
  );
  const vendorTotal = useCallback(
    (order: OrderRecord) => vendorItems(order).reduce((sum, item) => sum + item.price * item.qty, 0),
    [vendorItems]
  );

  const handleStatusChange = async (order: OrderRecord, status: OrderStatus) => {
    setSavingId(order.id);
    try {
      await updateOrderStatus(order.id, status);
      setDetailsOrder((prev) => (prev && prev.id === order.id ? { ...prev, status } : prev));
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update the order status.");
    } finally {
      setSavingId(null);
    }
  };

  useEffect(() => {
    if (!detailsOrder) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailsOrder(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailsOrder]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incoming Orders</h1>
          <p className="text-sm text-gray-500">
            {loading && !result
              ? "Loading your orders…"
              : `${total} order${total === 1 ? "" : "s"}${hasQuery ? " match your search" : ""}`}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label htmlFor="vendor-order-search" className={LABEL_CLASS}>Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                id="vendor-order-search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Order ID, buyer name, phone or product"
                className={`${CONTROL_CLASS} pl-9`}
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="lg:w-48">
            <label htmlFor="vendor-order-status" className={LABEL_CLASS}>Status</label>
            <select
              id="vendor-order-status"
              value={filters.status}
              onChange={(e) => updateFilter("status", e.target.value as Filters["status"])}
              className={CONTROL_CLASS}
            >
              <option value="all">All statuses</option>
              {ORDER_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div className="lg:w-52">
            <label htmlFor="vendor-order-sort" className={LABEL_CLASS}>Sort by</label>
            <select
              id="vendor-order-sort"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as OrderSort);
                setPage(1);
              }}
              className={CONTROL_CLASS}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            aria-expanded={showFilters}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
              showFilters || activeFilterCount > 0
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-gray-300 hover:bg-gray-50"
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-emerald-600 px-2 text-xs font-semibold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 gap-4 border-t border-gray-200 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="vendor-order-source" className={LABEL_CLASS}>Order type</label>
              <select
                id="vendor-order-source"
                value={filters.source}
                onChange={(e) => updateFilter("source", e.target.value as Filters["source"])}
                className={CONTROL_CLASS}
              >
                <option value="all">All</option>
                <option value="checkout">Checkout</option>
                <option value="auction">Auction win</option>
              </select>
            </div>
            <div>
              <label htmlFor="vendor-order-from" className={LABEL_CLASS}>Placed from</label>
              <input
                id="vendor-order-from"
                type="date"
                value={filters.dateFrom}
                max={filters.dateTo || undefined}
                onChange={(e) => updateFilter("dateFrom", e.target.value)}
                className={CONTROL_CLASS}
              />
            </div>
            <div>
              <label htmlFor="vendor-order-to" className={LABEL_CLASS}>Placed to</label>
              <input
                id="vendor-order-to"
                type="date"
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={(e) => updateFilter("dateTo", e.target.value)}
                className={CONTROL_CLASS}
              />
            </div>
            {hasQuery && (
              <div className="flex items-end justify-end sm:col-span-2 lg:col-span-4">
                <button type="button" onClick={clearAll} className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
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
          <button
            onClick={() => {
              void refreshOrders();
              refresh();
            }}
            className="ml-2 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="relative overflow-x-auto">
          {loading && result && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          )}
          <table className="min-w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Order</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Buyer</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Your items</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Your total</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Placed</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && !result && <SkeletonTableRows rows={5} columns={7} label="Loading your orders" />}

              {!loading && orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <PackageSearch className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                    {hasQuery ? (
                      <>
                        <p className="font-medium text-gray-700">No orders match your search.</p>
                        <button type="button" onClick={clearAll} className="mt-2 text-sm font-medium text-emerald-700 hover:text-emerald-800">
                          Clear search &amp; filters
                        </button>
                      </>
                    ) : (
                      <p className="font-medium text-gray-700">No incoming orders yet.</p>
                    )}
                  </td>
                </tr>
              )}

              {orders.map((order) => {
                const items = vendorItems(order);
                return (
                  <tr key={order.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{order.id}</p>
                      <p className="text-xs text-gray-500">
                        {order.source === "auction" ? "Auction win" : "Checkout"} · {order.paymentMethod.toUpperCase()}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-800">{order.customerInfo.fullName}</p>
                      <p className="text-xs text-gray-500">{order.customerInfo.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {items.length} item{items.length === 1 ? "" : "s"}
                      <p className="max-w-[220px] truncate text-xs text-gray-500">
                        {items.map((item) => `${item.qty}× ${item.title}`).join(", ")}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(vendorTotal(order))}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDateTime(order.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <label htmlFor={`status-${order.id}`} className="sr-only">Update status for {order.id}</label>
                        <select
                          id={`status-${order.id}`}
                          value={order.status}
                          disabled={savingId === order.id}
                          onChange={(e) => void handleStatusChange(order, e.target.value as OrderStatus)}
                          className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm disabled:opacity-50"
                        >
                          {ORDER_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setDetailsOrder(order)}
                          className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm hover:bg-gray-50"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>{total === 0 ? "No results" : `Showing ${rangeStart}–${rangeEnd} of ${total}`}</span>
            <label htmlFor="vendor-orders-page-size" className="flex items-center gap-2">
              <span className="font-medium text-gray-700">Rows per page</span>
              <select
                id="vendor-orders-page-size"
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
                    entry === page ? "border-emerald-600 bg-emerald-600 text-white" : "border-gray-300 hover:bg-gray-50"
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
      </div>

      {detailsOrder && (
        <Modal open onClose={() => setDetailsOrder(null)} label="Order details" size="max-w-2xl">
          <div className="max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Order details</p>
                <h3 className="mt-1 text-2xl font-bold text-gray-900">{detailsOrder.id}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {formatDateTime(detailsOrder.createdAt)} · {detailsOrder.source === "auction" ? "Auction win" : "Checkout"}
                </p>
              </div>
              <button onClick={() => setDetailsOrder(null)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Buyer</p>
                <p className="mt-1 font-semibold text-gray-900">{detailsOrder.customerInfo.fullName}</p>
                <p className="text-sm text-gray-600">{detailsOrder.customerInfo.phone}</p>
                {detailsOrder.customerInfo.email && (
                  <p className="text-sm text-gray-600">{detailsOrder.customerInfo.email}</p>
                )}
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Delivery address</p>
                <p className="mt-1 text-sm text-gray-700">{detailsOrder.addressInfo.fullAddress}</p>
                <p className="text-sm text-gray-600">
                  {detailsOrder.addressInfo.city}
                  {detailsOrder.addressInfo.postalCode ? ` · ${detailsOrder.addressInfo.postalCode}` : ""}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Your items in this order</p>
              <div className="mt-2 space-y-2">
                {vendorItems(detailsOrder).map((item) => (
                  <div key={`${detailsOrder.id}-${item.productId}`} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    <span className="text-gray-700">{item.qty}× {item.title}</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-sm">
                <span className="text-gray-500">Subtotal for your items</span>
                <span className="font-bold text-gray-900">{formatCurrency(vendorTotal(detailsOrder))}</span>
              </div>
              {detailsOrder.items.length !== vendorItems(detailsOrder).length && (
                <p className="mt-2 text-xs text-gray-500">
                  This order also contains items from other vendors, which are not shown.
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
              <label htmlFor="details-status" className="text-sm font-medium text-gray-700">Order status</label>
              <select
                id="details-status"
                value={detailsOrder.status}
                disabled={savingId === detailsOrder.id}
                onChange={(e) => void handleStatusChange(detailsOrder, e.target.value as OrderStatus)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
              >
                {ORDER_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              {savingId === detailsOrder.id && <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default VendorOrders;
