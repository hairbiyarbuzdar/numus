import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOrders } from "../../context/OrdersContext";
import { buildPageList, formatCurrency } from "../../utils/helpers";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { SkeletonTableRows } from "../../components/Skeleton";
import Modal from "../../components/Modal";
import {
  OrderQuery,
  OrderSort,
  OrderSource,
  OrderStatus,
  PaginatedOrders,
  orderApi,
} from "../../services/orderApi";

const ORDER_STATUS_OPTIONS: OrderStatus[] = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"];
const PAGE_SIZE_OPTIONS = [10, 25, 50];
const SEARCH_DEBOUNCE_MS = 400;

const AdminOrders: React.FC = () => {
  const { updateOrderStatus } = useOrders();

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | OrderSource>("all");
  const [sort, setSort] = useState<OrderSort>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  const [result, setResult] = useState<PaginatedOrders | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  // Debounce typing so we don't fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const ordersQuery = useMemo<OrderQuery>(
    () => ({
      search: query || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      source: sourceFilter === "all" ? undefined : sourceFilter,
      sort,
      page,
      pageSize,
    }),
    [page, pageSize, query, sort, sourceFilter, statusFilter]
  );

  // Searching, filtering and paging all run in SQL — this page used to pull
  // every order into the browser and filter the array.
  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);

    orderApi
      .listOrdersPage(ordersQuery)
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
  }, [ordersQuery, page, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((prev) => prev + 1), []);

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    setSavingId(orderId);
    try {
      await updateOrderStatus(orderId, status);
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update the order status.");
    } finally {
      setSavingId(null);
    }
  };

  const filteredOrders = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const hasQuery = Boolean(query) || statusFilter !== "all" || sourceFilter !== "all";

  const clearAll = () => {
    setSearchInput("");
    setQuery("");
    setStatusFilter("all");
    setSourceFilter("all");
    setSort("newest");
    setPage(1);
  };

  const activeOrder = activeOrderId ? filteredOrders.find((order) => order.id === activeOrderId) : null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-cyan-900 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight">Orders Management</h1>
        <p className="mt-2 text-sm text-cyan-100">Review all customer and auction orders, then update fulfillment status.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <label htmlFor="admin-orders-search" className="sr-only">Search orders</label>
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
            <input
              id="admin-orders-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Order ID, customer, phone or product"
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm"
            />
          </div>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as "all" | OrderStatus);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
          >
            <option value="all">All Status</option>
            {ORDER_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <select
            aria-label="Filter by order type"
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value as "all" | OrderSource);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
          >
            <option value="all">All Types</option>
            <option value="checkout">Checkout</option>
            <option value="auction">Auction win</option>
          </select>
          <select
            aria-label="Sort orders"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as OrderSort);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="total_desc">Value (high to low)</option>
            <option value="total_asc">Value (low to high)</option>
          </select>
          {hasQuery && (
            <div className="lg:col-span-5 flex justify-end">
              <button type="button" onClick={clearAll} className="text-sm font-medium text-cyan-700 hover:text-cyan-800">
                Clear search &amp; filters
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Order ID</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Customer</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Source</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Items</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Total</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Payment</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <tr key={order.id} className="border-t border-slate-100 text-slate-700">
                <td className="px-4 py-3 font-semibold">{order.id}</td>
                <td className="px-4 py-3">{order.customerInfo.fullName}</td>
                <td className="px-4 py-3 capitalize">{order.source}</td>
                <td className="px-4 py-3">{order.items.length}</td>
                <td className="px-4 py-3 font-semibold">{formatCurrency(order.total)}</td>
                <td className="px-4 py-3 uppercase">{order.paymentMethod}</td>
                <td className="px-4 py-3">{new Date(order.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <select
                    aria-label={`Update status for ${order.id}`}
                    value={order.status}
                    disabled={savingId === order.id}
                    onChange={(e) => void handleStatusChange(order.id, e.target.value as OrderStatus)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white disabled:opacity-50"
                  >
                    {ORDER_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setActiveOrderId(order.id)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {loading && !result && <SkeletonTableRows rows={5} columns={9} label="Loading orders" />}
            {!loading && filteredOrders.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                  {hasQuery ? (
                    <>
                      <p className="font-medium text-slate-700">No orders match your search.</p>
                      <button type="button" onClick={clearAll} className="mt-2 text-sm font-medium text-cyan-700 hover:text-cyan-800">
                        Clear search &amp; filters
                      </button>
                    </>
                  ) : (
                    <p className="font-medium text-slate-700">No orders yet.</p>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>{total === 0 ? "No results" : `Showing ${rangeStart}–${rangeEnd} of ${total}`}</span>
            <label htmlFor="admin-orders-page-size" className="flex items-center gap-2">
              <span className="font-medium text-slate-700">Rows per page</span>
              <select
                id="admin-orders-page-size"
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
      </div>

      {listError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {listError}
          <button onClick={refresh} className="ml-2 font-semibold underline">Retry</button>
        </div>
      )}

      {activeOrder && (
        <Modal open onClose={() => setActiveOrderId(null)} label="Order details" size="max-w-2xl">
          <div className="max-h-[85vh] overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Order Details: {activeOrder.id}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {activeOrder.customerInfo.fullName} | {activeOrder.customerInfo.phone} | {activeOrder.addressInfo.city}
            </p>
            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
              {activeOrder.items.map((item) => (
                <div key={`${activeOrder.id}-${item.productId}`} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900">{item.title}</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(item.price * item.qty)}</p>
                  </div>
                  <p className="text-xs text-gray-500">{item.qty} x {formatCurrency(item.price)} | {item.vendorName}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-2 text-sm text-gray-700">
              <p>Payment: <span className="font-semibold uppercase">{activeOrder.paymentMethod}</span></p>
              <p>Address: <span className="font-semibold">{activeOrder.addressInfo.fullAddress}, {activeOrder.addressInfo.city}</span></p>
              <p>Total: <span className="font-semibold">{formatCurrency(activeOrder.total)}</span></p>
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setActiveOrderId(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Close</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminOrders;
