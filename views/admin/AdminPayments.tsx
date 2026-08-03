import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Banknote, ChevronLeft, ChevronRight, Loader2, Search, Wallet } from "lucide-react";
import { buildPageList, formatCurrency, formatDateTime } from "../../utils/helpers";
import { SkeletonStats, SkeletonTableRows } from "../../components/Skeleton";
import {
  OrderQuery,
  OrderSort,
  OrderStatus,
  OrderSummary,
  PaginatedOrders,
  orderApi,
} from "../../services/orderApi";

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const SEARCH_DEBOUNCE_MS = 400;

const CONTROL_CLASS =
  "rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500";

const PAYMENT_METHODS = [
  { value: "all", label: "All Methods" },
  { value: "easypaisa", label: "Easypaisa" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "cod", label: "Cash on Delivery" },
];

const ORDER_STATUSES: OrderStatus[] = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"];

/**
 * A payment's state follows the order it belongs to: money is only realised
 * once the order is delivered, and a cancelled order is not owed at all.
 */
const paymentStatus = (status: OrderStatus) => {
  if (status === "Delivered") return { label: "Settled", className: "bg-emerald-100 text-emerald-700" };
  if (status === "Cancelled") return { label: "Cancelled", className: "bg-red-100 text-red-700" };
  return { label: "Pending", className: "bg-amber-100 text-amber-700" };
};

const AdminPayments: React.FC = () => {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("all");
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [sort, setSort] = useState<OrderSort>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  const [result, setResult] = useState<PaginatedOrders | null>(null);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestIdRef = useRef(0);

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
      status: status === "all" ? undefined : status,
      sort,
      page,
      pageSize,
    }),
    [page, pageSize, search, sort, status]
  );

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);

    Promise.all([orderApi.listOrdersPage(query), orderApi.getSummary()])
      .then(([orders, totals]) => {
        if (requestId !== requestIdRef.current) return;
        setResult(orders);
        setSummary(totals);
        setError(null);
        if (orders.page !== page) setPage(orders.page);
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        setResult(null);
        setError(err instanceof Error ? err.message : "Failed to load payments.");
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [query, page, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((prev) => prev + 1), []);

  // Payment method isn't a server-side filter on orders, so it narrows the page
  // that came back. The count shown reflects what the server matched.
  const rows = (result?.data ?? []).filter((order) => method === "all" || order.paymentMethod === method);
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;
  const hasQuery = Boolean(search) || status !== "all" || method !== "all";

  const clearAll = () => {
    setSearchInput("");
    setSearch("");
    setMethod("all");
    setStatus("all");
    setSort("newest");
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-cyan-900 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight">Payments Overview</h1>
        <p className="mt-2 text-sm text-cyan-100">
          Every payment is an order: what was charged, how it was paid, and whether the money has been realised.
        </p>
      </section>

      {!summary && !error && (
        <SkeletonStats count={3} className="grid grid-cols-1 gap-4 sm:grid-cols-3" label="Loading payment totals" />
      )}

      {summary && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Settled</p>
              <Wallet className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{formatCurrency(summary.earnedRevenue)}</p>
            <p className="mt-2 text-xs text-slate-500">{summary.byStatus.Delivered} delivered order(s)</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Awaiting settlement</p>
              <Banknote className="h-5 w-5 text-amber-600" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {formatCurrency(summary.grossRevenue - summary.earnedRevenue)}
            </p>
            <p className="mt-2 text-xs text-slate-500">Ordered but not yet delivered</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Total charged</p>
              <Banknote className="h-5 w-5 text-cyan-700" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{formatCurrency(summary.grossRevenue)}</p>
            <p className="mt-2 text-xs text-slate-500">{summary.totalOrders} payment(s) across all orders</p>
          </article>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <label htmlFor="payments-search" className="sr-only">Search payments</label>
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
            <input
              id="payments-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Order ID, payer name, phone or product"
              className={`${CONTROL_CLASS} w-full pl-9`}
            />
          </div>
          <select aria-label="Filter by payment method" value={method} onChange={(e) => setMethod(e.target.value)} className={CONTROL_CLASS}>
            {PAYMENT_METHODS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            aria-label="Filter by order status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as OrderStatus | "all");
              setPage(1);
            }}
            className={CONTROL_CLASS}
          >
            <option value="all">All Statuses</option>
            {ORDER_STATUSES.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <select
            aria-label="Sort payments"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as OrderSort);
              setPage(1);
            }}
            className={CONTROL_CLASS}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="total_desc">Amount (high to low)</option>
            <option value="total_asc">Amount (low to high)</option>
          </select>
          {hasQuery && (
            <div className="lg:col-span-4 flex justify-end">
              <button type="button" onClick={clearAll} className="text-sm font-medium text-cyan-700 hover:text-cyan-800">
                Clear search &amp; filters
              </button>
            </div>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
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
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Order ID</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Payer</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Method</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Amount</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && !result && <SkeletonTableRows rows={5} columns={6} label="Loading payments" />}

              {rows.map((order) => {
                const badge = paymentStatus(order.status);
                return (
                  <tr key={order.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold text-slate-800">{order.id}</td>
                    <td className="px-4 py-3">
                      <p className="text-slate-800">{order.customerInfo.fullName}</p>
                      <p className="text-xs text-slate-500">{order.customerInfo.phone}</p>
                    </td>
                    <td className="px-4 py-3 uppercase text-slate-700">{order.paymentMethod}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{formatCurrency(order.total)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(order.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    {hasQuery ? (
                      <>
                        <p className="font-medium text-slate-700">No payments match your search.</p>
                        <button type="button" onClick={clearAll} className="mt-2 text-sm font-medium text-cyan-700 hover:text-cyan-800">
                          Clear search &amp; filters
                        </button>
                      </>
                    ) : (
                      <p className="font-medium text-slate-700">No payments yet.</p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>{total === 0 ? "No results" : `${total} payment${total === 1 ? "" : "s"}`}</span>
            <label htmlFor="payments-page-size" className="flex items-center gap-2">
              <span className="font-medium text-slate-700">Rows per page</span>
              <select
                id="payments-page-size"
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
    </div>
  );
};

export default AdminPayments;
