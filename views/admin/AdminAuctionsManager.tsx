import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Gavel,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import ConfirmModal from "../../components/ConfirmModal";
import { Product } from "../../types";
import { useProducts } from "../../context/ProductContext";
import { useOrders } from "../../context/OrdersContext";
import {
  AuctionState,
  PaginatedProducts,
  ProductDateField,
  ProductQuery,
  ProductSort,
  productApi,
} from "../../services/productApi";
import {
  AUCTION_STATUS_BADGE_CLASSES,
  AUCTION_STATUS_LABELS,
  AuctionDisplayStatus,
  buildPageList,
  formatCurrency,
  getAuctionDisplayStatus,
  getTimeRemaining,
} from "../../utils/helpers";

const STATUS_OPTIONS: { value: AuctionState; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "rejected", label: "Rejected" },
  { value: "ended", label: "Completed (Ended)" },
  { value: "cancelled", label: "Cancelled" },
];

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "ending_soonest", label: "Ending soonest" },
  { value: "ending_latest", label: "Ending last" },
  { value: "bid_desc", label: "Highest bid" },
  { value: "bid_asc", label: "Lowest bid" },
  { value: "price_asc", label: "Starting price (low to high)" },
  { value: "price_desc", label: "Starting price (high to low)" },
  { value: "title_asc", label: "Title (A–Z)" },
  { value: "title_desc", label: "Title (Z–A)" },
];

const DATE_FIELD_OPTIONS: { value: ProductDateField; label: string }[] = [
  { value: "created", label: "Created date" },
  { value: "start", label: "Auction start" },
  { value: "end", label: "Auction end" },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const SEARCH_DEBOUNCE_MS = 400;

const LABEL_CLASS = "mb-1 block text-sm font-medium text-slate-700";
const CONTROL_CLASS =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500";

interface Filters {
  auctionState: AuctionState | "all";
  category: string;
  dateField: ProductDateField;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: Filters = {
  auctionState: "all",
  category: "all",
  dateField: "created",
  dateFrom: "",
  dateTo: "",
};

// `<input type="date">` gives a calendar day; the API wants epoch milliseconds.
// Anchor the range to the admin's own clock: the whole "from" day and the whole
// "to" day are included.
const startOfDay = (value: string) => (value ? new Date(`${value}T00:00:00`).getTime() : undefined);
const endOfDay = (value: string) => (value ? new Date(`${value}T23:59:59.999`).getTime() : undefined);

const formatDateTime = (timestamp?: number) =>
  timestamp ? new Date(timestamp).toLocaleString() : "—";

const describeTimeRemaining = (endTime: number | undefined, status: AuctionDisplayStatus) => {
  if (!endTime) return "—";
  if (status === "cancelled") return "Cancelled";
  if (status === "ended") return "Ended";
  if (status !== "active") return "Not started (awaiting review)";

  const { days, hours, minutes } = getTimeRemaining(endTime);
  if (days + hours + minutes === 0) return "Less than a minute";
  return [days ? `${days}d` : null, hours ? `${hours}h` : null, minutes ? `${minutes}m` : null]
    .filter(Boolean)
    .join(" ");
};

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 break-words font-semibold text-slate-900">{value}</p>
  </div>
);

const AdminAuctionsManager: React.FC = () => {
  const { closeAuction, cancelAuction, deleteProduct } = useProducts();
  const { settleAuctions } = useOrders();

  // ─── Search / filter / pagination state ────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<ProductSort>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  const [result, setResult] = useState<PaginatedProducts | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Held as a snapshot rather than an id so reloading the table underneath
  // (filtering, paging, an action) can't yank the modal closed.
  const [detailsAuction, setDetailsAuction] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

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
      productType: "auction",
      search: search || undefined,
      auctionState: filters.auctionState === "all" ? undefined : filters.auctionState,
      category: filters.category === "all" ? undefined : filters.category,
      dateField: filters.dateFrom || filters.dateTo ? filters.dateField : undefined,
      dateFrom: startOfDay(filters.dateFrom),
      dateTo: endOfDay(filters.dateTo),
      sort,
      page,
      pageSize,
    }),
    [search, filters, sort, page, pageSize]
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
        // The API clamps an out-of-range page (e.g. after the last row on the
        // final page is deleted) — mirror that back into local state.
        if (response.page !== page) setPage(response.page);
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        setResult(null);
        setListError(err instanceof Error ? err.message : "Failed to load auctions.");
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [query, refreshKey, page]);

  useEffect(() => {
    let active = true;
    productApi
      .listFilterOptions({ productType: "auction" })
      .then((response) => {
        if (active) setCategories(response.categories);
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const refresh = useCallback(() => setRefreshKey((prev) => prev + 1), []);

  /**
   * Settling expired auctions runs once when this page opens, and otherwise
   * only when the admin asks for it.
   *
   * It used to poll on a timer, which meant a request every few seconds for a
   * result that is almost always "nothing changed" — and each one re-rendered
   * the page. The table is only reloaded when something actually closed.
   */
  const [settling, setSettling] = useState(false);

  const runSettlement = useCallback(async () => {
    setSettling(true);
    try {
      const settled = await settleAuctions();
      if (settled > 0) refresh();
      return settled;
    } finally {
      setSettling(false);
    }
  }, [refresh, settleAuctions]);

  useEffect(() => {
    void runSettlement();
    // Once per visit to this page — deliberately not on an interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  // dateField on its own changes nothing until a range is set, so it isn't counted.
  const activeFilterCount = useMemo(
    () =>
      (["auctionState", "category", "dateFrom", "dateTo"] as (keyof Filters)[]).filter(
        (key) => filters[key] !== EMPTY_FILTERS[key]
      ).length,
    [filters]
  );

  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setSearchInput("");
    setSearch("");
    setSort("newest");
    setPage(1);
  };

  const auctions = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const hasQuery = Boolean(search) || activeFilterCount > 0;

  useEffect(() => {
    if (!detailsAuction) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailsAuction(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailsAuction]);

  const handleClose = async (auction: Product) => {
    const outcome = await closeAuction(auction.id);
    if (!outcome.ok) {
      alert("Unable to close auction.");
      return;
    }
    refresh();
  };

  const handleCancel = async (auction: Product) => {
    const outcome = await cancelAuction(auction.id);
    if (!outcome.ok) {
      alert("Unable to cancel auction.");
      return;
    }
    refresh();
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-cyan-900 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight">Auctions Management</h1>
        <p className="mt-2 text-sm text-cyan-100">Monitor auction performance, inspect bids, close/cancel, and remove listings.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label htmlFor="auction-search" className={LABEL_CLASS}>Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                id="auction-search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Auction ID, product name, vendor or category"
                className={`${CONTROL_CLASS} pl-9`}
              />
            </div>
          </div>
          <div className="lg:w-56">
            <label htmlFor="auction-status" className={LABEL_CLASS}>Status</label>
            <select
              id="auction-status"
              value={filters.auctionState}
              onChange={(e) => updateFilter("auctionState", e.target.value as AuctionState | "all")}
              className={CONTROL_CLASS}
            >
              <option value="all">All Status</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="lg:w-64">
            <label htmlFor="auction-sort" className={LABEL_CLASS}>Sort By</label>
            <select
              id="auction-sort"
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
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            aria-expanded={showFilters}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
              showFilters || activeFilterCount > 0
                ? "border-cyan-600 bg-cyan-50 text-cyan-700"
                : "border-gray-300 hover:bg-gray-50"
            }`}
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-cyan-600 px-2 text-xs font-semibold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Replaces the old background polling: closing expired auctions is
              on demand now, so nothing runs while the admin is idle. */}
          <button
            type="button"
            onClick={() => {
              void runSettlement();
              refresh();
            }}
            disabled={settling || loading}
            title="Reload the list and close any auctions past their end time"
            aria-label="Refresh auctions and close expired ones"
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${settling ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 gap-4 border-t border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="auction-category" className={LABEL_CLASS}>Category</label>
              <select
                id="auction-category"
                value={filters.category}
                onChange={(e) => updateFilter("category", e.target.value)}
                className={CONTROL_CLASS}
              >
                <option value="all">All</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="auction-date-field" className={LABEL_CLASS}>Date Range Applies To</label>
              <select
                id="auction-date-field"
                value={filters.dateField}
                onChange={(e) => updateFilter("dateField", e.target.value as ProductDateField)}
                className={CONTROL_CLASS}
              >
                {DATE_FIELD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="auction-date-from" className={LABEL_CLASS}>From</label>
              <input
                id="auction-date-from"
                type="date"
                value={filters.dateFrom}
                max={filters.dateTo || undefined}
                onChange={(e) => updateFilter("dateFrom", e.target.value)}
                className={CONTROL_CLASS}
              />
            </div>
            <div>
              <label htmlFor="auction-date-to" className={LABEL_CLASS}>To</label>
              <input
                id="auction-date-to"
                type="date"
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={(e) => updateFilter("dateTo", e.target.value)}
                className={CONTROL_CLASS}
              />
            </div>
            {hasQuery && (
              <div className="flex justify-end sm:col-span-2 lg:col-span-4">
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-sm font-medium text-cyan-700 hover:text-cyan-800"
                >
                  Clear search &amp; filters
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {listError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {listError}
          <button onClick={refresh} className="ml-2 font-semibold underline">
            Retry
          </button>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative overflow-x-auto">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
            </div>
          )}
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Auction</th>
                <th className="px-4 py-3 text-left font-semibold">Start Price</th>
                <th className="px-4 py-3 text-left font-semibold">Highest Bid</th>
                <th className="px-4 py-3 text-left font-semibold">Bids</th>
                <th className="px-4 py-3 text-left font-semibold">Start</th>
                <th className="px-4 py-3 text-left font-semibold">End</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {auctions.map((auction) => {
              const displayStatus: AuctionDisplayStatus = getAuctionDisplayStatus(auction);
              // Closing/cancelling only makes sense for an approved, running auction.
              const isRunning = displayStatus === "active";
              return (
              <tr key={auction.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img src={auction.images[0]} alt={auction.title} className="h-12 w-12 rounded-lg object-cover" />
                    <div>
                      <p className="font-semibold text-slate-800">{auction.title}</p>
                      <p className="text-xs text-slate-500">{auction.vendorName}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{formatCurrency(auction.startingPrice || 0)}</td>
                <td className="px-4 py-3">{formatCurrency(auction.currentHighestBid || 0)}</td>
                <td className="px-4 py-3">{auction.bids?.length || 0}</td>
                <td className="px-4 py-3">{auction.auctionStartTime ? new Date(auction.auctionStartTime).toLocaleString() : "-"}</td>
                <td className="px-4 py-3">{auction.auctionEndTime ? new Date(auction.auctionEndTime).toLocaleString() : "-"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${AUCTION_STATUS_BADGE_CLASSES[displayStatus]}`}>
                      {AUCTION_STATUS_LABELS[displayStatus].toUpperCase()}
                    </span>
                    {displayStatus === "rejected" && auction.rejectionReason && (
                      <p className="max-w-[200px] text-xs text-red-500">{auction.rejectionReason}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDetailsAuction(auction)}
                      title="View details"
                      aria-label={`View details for ${auction.title}`}
                      className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => void handleClose(auction)}
                      title={isRunning ? "Close auction now and pick a winner" : "Only an approved, running auction can be closed"}
                      aria-label={`Close the auction for ${auction.title}`}
                      className="rounded-md border border-emerald-300 p-1.5 text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!isRunning}
                    >
                      <Gavel className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => void handleCancel(auction)}
                      title={isRunning ? "Cancel auction without a winner" : "Only an approved, running auction can be cancelled"}
                      aria-label={`Cancel the auction for ${auction.title}`}
                      className="rounded-md border border-amber-300 p-1.5 text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!isRunning}
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(auction)}
                      title="Delete auction permanently"
                      aria-label={`Delete the auction for ${auction.title}`}
                      className="rounded-md border border-red-300 p-1.5 text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
              {auctions.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    {hasQuery ? (
                      <>
                        <p className="font-medium text-slate-700">No auctions match your search.</p>
                        <button
                          type="button"
                          onClick={clearAll}
                          className="mt-2 text-sm font-medium text-cyan-700 hover:text-cyan-800"
                        >
                          Clear search &amp; filters
                        </button>
                      </>
                    ) : (
                      <p className="font-medium text-slate-700">No auctions have been created yet.</p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>{total === 0 ? "No results" : `Showing ${rangeStart}–${rangeEnd} of ${total}`}</span>
            <label htmlFor="auction-rows-per-page" className="flex items-center gap-2">
              <span className="font-medium text-slate-700">Rows per page</span>
              <select
                id="auction-rows-per-page"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
              <ChevronLeft className="h-4 w-4" />
              Prev
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
                  className={`min-w-[36px] rounded-lg border px-2 py-1.5 text-sm transition-colors disabled:cursor-not-allowed ${
                    entry === page
                      ? "border-cyan-600 bg-cyan-600 text-white"
                      : "border-gray-300 hover:bg-gray-50"
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
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {detailsAuction && (() => {
        const status = getAuctionDisplayStatus(detailsAuction);
        const bids = [...(detailsAuction.bids || [])].sort((a, b) => b.timestamp - a.timestamp);
        // Prefer the stored highest bid the backend maintains; fall back to the
        // bid list in case it wasn't hydrated.
        const topBid =
          detailsAuction.currentHighestBid ??
          bids.reduce<number | null>(
            (highest, bid) => (highest === null || bid.amount > highest ? bid.amount : highest),
            null
          );
        const images = detailsAuction.images?.filter(Boolean) || [];

        return (
        <div className="fixed inset-0 z-[94] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Auction details">
          <button className="absolute inset-0 bg-black/50" aria-label="Close details" onClick={() => setDetailsAuction(null)} />
          <div className="relative max-h-[90vh] w-[95%] max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Auction details</p>
                <h3 className="mt-1 truncate text-2xl font-bold text-slate-900">{detailsAuction.title}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  By <span className="font-medium">{detailsAuction.vendorName}</span>
                  {detailsAuction.category ? ` | ${detailsAuction.category}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${AUCTION_STATUS_BADGE_CLASSES[status]}`}>
                    {AUCTION_STATUS_LABELS[status].toUpperCase()}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    ID: <span className="font-mono">{detailsAuction.id}</span>
                  </span>
                </div>
              </div>
              <button onClick={() => setDetailsAuction(null)} className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Close
              </button>
            </div>

            {status === "rejected" && detailsAuction.rejectionReason && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <span className="font-semibold">Rejection reason:</span> {detailsAuction.rejectionReason}
              </div>
            )}
            {status === "pending" && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                This auction is awaiting admin review and is not visible to buyers yet.
              </div>
            )}

            <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
              <div>
                {images.length > 0 ? (
                  <>
                    <img
                      src={images[0]}
                      alt={detailsAuction.title}
                      className="h-52 w-full rounded-2xl border border-slate-200 object-cover"
                    />
                    {images.length > 1 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {images.slice(1).map((image, index) => (
                          <img
                            key={`${image}-${index}`}
                            src={image}
                            alt={`${detailsAuction.title} ${index + 2}`}
                            className="h-14 w-14 rounded-lg border border-slate-200 object-cover"
                          />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex h-52 w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400">
                    No images
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Fact label="Starting price" value={formatCurrency(detailsAuction.startingPrice || 0)} />
                  <Fact
                    label="Current bid"
                    value={topBid === null ? "No bids yet" : formatCurrency(topBid)}
                  />
                  <Fact label="Bid increment" value={formatCurrency(detailsAuction.bidIncrement || 0)} />
                  <Fact
                    label="Buy now price"
                    value={detailsAuction.buyNowPrice ? formatCurrency(detailsAuction.buyNowPrice) : "Not set"}
                  />
                  <Fact label="Quantity" value={String(detailsAuction.auctionQuantity ?? 1)} />
                  <Fact label="Total bids" value={String(bids.length)} />
                  <Fact label="Starts" value={formatDateTime(detailsAuction.auctionStartTime)} />
                  <Fact label="Ends" value={formatDateTime(detailsAuction.auctionEndTime)} />
                  <Fact label="Time remaining" value={describeTimeRemaining(detailsAuction.auctionEndTime, status)} />
                  <Fact label="Created" value={formatDateTime(detailsAuction.createdAt)} />
                  <Fact label="Submitted for review" value={formatDateTime(detailsAuction.submittedAt)} />
                  <Fact
                    label={status === "rejected" ? "Rejected on" : "Approved on"}
                    value={formatDateTime(status === "rejected" ? detailsAuction.rejectedAt : detailsAuction.approvedAt)}
                  />
                </div>

                {detailsAuction.winnerBidderName && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    <span className="font-semibold">Winning bidder:</span> {detailsAuction.winnerBidderName}
                    {topBid !== null && <> at {formatCurrency(topBid)}</>}
                    {detailsAuction.winnerOrderId && (
                      <p className="mt-1 text-xs text-emerald-700">Order: <span className="font-mono">{detailsAuction.winnerOrderId}</span></p>
                    )}
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
                  <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    {detailsAuction.description || "No description provided."}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Bid history ({bids.length})
              </p>
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {bids.length === 0 && <p className="text-sm text-slate-500">No bids placed yet.</p>}
                {bids.map((bid) => (
                  <div key={bid.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900">{bid.bidderName}</p>
                      <p className="font-semibold text-emerald-700">{formatCurrency(bid.amount)}</p>
                    </div>
                    <p className="text-xs text-slate-500">{formatDateTime(bid.timestamp)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Auction"
        message="Delete this auction permanently?"
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          const target = deleteTarget;
          setDeleteTarget(null);
          if (detailsAuction?.id === target.id) setDetailsAuction(null);
          void deleteProduct(target.id)
            .then(refresh)
            .catch((err) => {
              alert(err instanceof Error ? err.message : "Failed to delete auction.");
            });
        }}
      />
    </div>
  );
};

export default AdminAuctionsManager;
