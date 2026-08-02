import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Gavel,
  Loader2,
  Search,
  Trophy,
  X,
} from "lucide-react";
import { useProducts } from "../../context/ProductContext";
import { useAuth } from "../../context/AuthContext";
import { useOrders } from "../../context/OrdersContext";
import {
  buildPageList,
  formatCurrency,
  formatDateTime,
  getTimeRemaining,
  hasAuctionStarted,
} from "../../utils/helpers";
import { SkeletonCards } from "../../components/Skeleton";
import {
  PaginatedProducts,
  ProductFilterOptions,
  ProductQuery,
  ProductSort,
  productApi,
} from "../../services/productApi";

const SEARCH_DEBOUNCE_MS = 400;
const PAGE_SIZE_OPTIONS = [6, 12, 24];

type StatusFilter = "all" | "live" | "upcoming" | "ended";

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "ending_soonest", label: "Ending soonest" },
  { value: "ending_latest", label: "Ending last" },
  { value: "newest", label: "Newest first" },
  { value: "bid_desc", label: "Highest bid" },
  { value: "bid_asc", label: "Lowest bid" },
];

const CONTROL_CLASS =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500";
const LABEL_CLASS = "mb-1 block text-sm font-medium text-gray-700";

interface Filters {
  status: StatusFilter;
  category: string;
  minPrice: string;
  maxPrice: string;
}

const EMPTY_FILTERS: Filters = { status: "all", category: "all", minPrice: "", maxPrice: "" };

const BuyerAuctions: React.FC = () => {
  const { user } = useAuth();
  const { placeBid } = useProducts();
  const { notifications, markNotificationRead } = useOrders();

  const [bidDrafts, setBidDrafts] = useState<Record<string, string>>({});
  const [biddingOn, setBiddingOn] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<ProductSort>("ending_soonest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  const [result, setResult] = useState<PaginatedProducts | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Debounce typing so we don't fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  /**
   * "Live" and "Upcoming" are both approved+running auctions, told apart by
   * whether the start time has passed — so the status filter drives both
   * `auctionState` and the start-time range.
   */
  const query = useMemo<ProductQuery>(() => {
    const base: ProductQuery = {
      productType: "auction",
      search: search || undefined,
      category: filters.category === "all" ? undefined : filters.category,
      minPrice: filters.minPrice === "" ? undefined : Number(filters.minPrice),
      maxPrice: filters.maxPrice === "" ? undefined : Number(filters.maxPrice),
      sort,
      page,
      pageSize,
    };

    const now = Date.now();
    if (filters.status === "live") {
      return { ...base, auctionState: "active", dateField: "start", dateTo: now };
    }
    if (filters.status === "upcoming") {
      return { ...base, auctionState: "active", dateField: "start", dateFrom: now };
    }
    if (filters.status === "ended") {
      return { ...base, auctionState: "ended" };
    }
    return base;
  }, [filters, page, pageSize, search, sort]);

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
        setListError(err instanceof Error ? err.message : "Failed to load auctions.");
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [query, page, refreshKey]);

  useEffect(() => {
    let active = true;
    productApi
      .listFilterOptions({ productType: "auction" })
      .then((response: ProductFilterOptions) => {
        if (active) setCategories(response.categories);
      })
      .catch(() => {
        if (active) setCategories([]);
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

  const activeFilterCount = useMemo(
    () => (Object.keys(EMPTY_FILTERS) as (keyof Filters)[]).filter((key) => filters[key] !== EMPTY_FILTERS[key]).length,
    [filters]
  );

  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setSearchInput("");
    setSearch("");
    setSort("ending_soonest");
    setPage(1);
  };

  const auctions = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;
  const hasQuery = Boolean(search) || activeFilterCount > 0;
  const myNotifications = notifications.filter((notification) => notification.userId === user?.uid);

  const handleBid = async (auctionId: string, amount: number) => {
    setBiddingOn(auctionId);
    try {
      const outcome = await placeBid({
        productId: auctionId,
        bidderId: user?.uid || "guest_buyer",
        bidderName: user?.displayName || "Buyer",
        amount,
      });
      alert(outcome.message);
      // The bid changes the highest bid, so reload the page of results.
      if (outcome.ok) {
        setBidDrafts((prev) => {
          const next = { ...prev };
          delete next[auctionId];
          return next;
        });
        refresh();
      }
    } finally {
      setBiddingOn(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-purple-100 bg-gradient-to-r from-purple-700 to-indigo-700 p-6 text-white">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gavel className="w-6 h-6" />
          Live Auctions
        </h1>
        <p className="text-sm text-purple-100 mt-2">Place bids and track highest bid updates in real time.</p>
      </div>

      {myNotifications.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
            <BellRing className="w-4 h-4 text-amber-600" />
            Notifications
          </h2>
          <div className="space-y-2">
            {myNotifications.map((notification) => (
              <div key={notification.id} className={`rounded-lg px-3 py-2 text-sm ${notification.read ? "bg-gray-50 text-gray-600" : "bg-amber-50 text-amber-800"}`}>
                <p className="font-semibold">{notification.title}</p>
                <p>{notification.message}</p>
                {!notification.read && (
                  <button onClick={() => markNotificationRead(notification.id)} className="mt-1 text-xs underline">
                    Mark as read
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label htmlFor="auction-search" className={LABEL_CLASS}>Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                id="auction-search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Auction, vendor or category"
                className={`${CONTROL_CLASS} pl-9`}
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="lg:w-44">
            <label htmlFor="auction-status" className={LABEL_CLASS}>Status</label>
            <select
              id="auction-status"
              value={filters.status}
              onChange={(e) => updateFilter("status", e.target.value as StatusFilter)}
              className={CONTROL_CLASS}
            >
              <option value="all">All auctions</option>
              <option value="live">Live now</option>
              <option value="upcoming">Upcoming</option>
              <option value="ended">Ended</option>
            </select>
          </div>
          <div className="lg:w-52">
            <label htmlFor="auction-sort" className={LABEL_CLASS}>Sort by</label>
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
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
              showFilters || activeFilterCount > 0
                ? "border-purple-500 bg-purple-50 text-purple-700"
                : "border-gray-300 hover:bg-gray-50"
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-purple-600 px-2 text-xs font-semibold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 gap-4 border-t border-gray-200 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="auction-category" className={LABEL_CLASS}>Category</label>
              <select
                id="auction-category"
                value={filters.category}
                onChange={(e) => updateFilter("category", e.target.value)}
                className={CONTROL_CLASS}
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <span className={LABEL_CLASS}>Starting price (PKR)</span>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label htmlFor="auction-min-price" className="mb-1 block text-xs text-gray-500">Min</label>
                  <input
                    id="auction-min-price"
                    type="number"
                    min={0}
                    value={filters.minPrice}
                    onChange={(e) => updateFilter("minPrice", e.target.value)}
                    placeholder="0"
                    className={CONTROL_CLASS}
                  />
                </div>
                <span className="pb-3 text-gray-400">–</span>
                <div className="flex-1">
                  <label htmlFor="auction-max-price" className="mb-1 block text-xs text-gray-500">Max</label>
                  <input
                    id="auction-max-price"
                    type="number"
                    min={0}
                    value={filters.maxPrice}
                    onChange={(e) => updateFilter("maxPrice", e.target.value)}
                    placeholder="Any"
                    className={CONTROL_CLASS}
                  />
                </div>
              </div>
            </div>
            {hasQuery && (
              <div className="flex items-end justify-end sm:col-span-2 lg:col-span-3">
                <button type="button" onClick={clearAll} className="text-sm font-medium text-purple-700 hover:text-purple-800">
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
          <button onClick={refresh} className="ml-2 font-semibold underline">Retry</button>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {loading && !result ? "Loading auctions…" : `${total} auction${total === 1 ? "" : "s"}${hasQuery ? " match your search" : ""}`}
        </span>
        {loading && result && <Loader2 className="h-4 w-4 animate-spin text-purple-600" />}
      </div>

      {loading && !result && <SkeletonCards count={2} label="Loading auctions" />}

      {!loading && auctions.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <p className="font-medium text-gray-700">
            {hasQuery ? "No auctions match your search." : "No auctions right now."}
          </p>
          {hasQuery && (
            <button type="button" onClick={clearAll} className="mt-2 text-sm font-medium text-purple-700 hover:text-purple-800">
              Clear search &amp; filters
            </button>
          )}
        </div>
      )}

      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-5 ${loading && result ? "opacity-60" : ""}`}>
        {auctions.map((auction) => {
          const isEnded = auction.auctionStatus === "ended";
          const isOpen = hasAuctionStarted(auction);
          const timeLeft = auction.auctionEndTime ? getTimeRemaining(auction.auctionEndTime) : null;
          const nextMin = (auction.currentHighestBid || auction.startingPrice || 0) + (auction.bidIncrement || 0);
          return (
            <article key={auction.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-gray-900">{auction.title}</h3>
                  <p className="text-sm text-gray-500">{auction.vendorName}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isEnded ? "bg-slate-100 text-slate-700" : !isOpen ? "bg-amber-100 text-amber-700" : "bg-purple-100 text-purple-700"}`}>
                  {isEnded ? "Ended" : !isOpen ? "Upcoming" : "Live"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Highest Bid</p>
                  <p className="font-bold text-gray-900">{formatCurrency(auction.currentHighestBid || 0)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Bids</p>
                  <p className="font-bold text-gray-900">{auction.bids?.length || 0}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 flex justify-center items-center gap-1"><Clock3 className="w-3 h-3" /> Time</p>
                  <p className="font-bold text-gray-900">{isEnded || !timeLeft ? "Closed" : `${timeLeft.days}d ${timeLeft.hours}h`}</p>
                </div>
              </div>

              {isEnded && auction.winnerBidderName && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800 flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  Winner: {auction.winnerBidderName}
                </div>
              )}

              {!isEnded && !isOpen && (
                <p className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-center gap-2">
                  <Clock3 className="w-4 h-4 shrink-0" />
                  Bidding opens {formatDateTime(auction.auctionStartTime)}.
                </p>
              )}

              {!isEnded && isOpen && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <label htmlFor={`bid-${auction.id}`} className="sr-only">Your bid for {auction.title}</label>
                    <input
                      id={`bid-${auction.id}`}
                      type="number"
                      min={nextMin}
                      value={bidDrafts[auction.id] || String(nextMin)}
                      onChange={(e) => setBidDrafts((prev) => ({ ...prev, [auction.id]: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <button
                      onClick={() => void handleBid(auction.id, Number(bidDrafts[auction.id] || nextMin))}
                      disabled={biddingOn === auction.id}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {biddingOn === auction.id && <Loader2 className="h-4 w-4 animate-spin" />}
                      Place Bid
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">Minimum next bid: {formatCurrency(nextMin)}</p>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {result && total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 sm:flex-row">
          <label htmlFor="auctions-page-size" className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium text-gray-700">Per page</span>
            <select
              id="auctions-page-size"
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
                    entry === page ? "border-purple-600 bg-purple-600 text-white" : "border-gray-300 hover:bg-gray-50"
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
      )}
    </div>
  );
};

export default BuyerAuctions;
