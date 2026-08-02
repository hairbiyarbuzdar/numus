import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Gavel,
  Loader2,
  Package,
  Search,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useProducts } from "../../context/ProductContext";
import { Product } from "../../types";
import { buildPageList, formatCurrency } from "../../utils/helpers";
import AdminVendorApprovalsQueue from "./AdminVendorApprovalsQueue";
import { SkeletonCards } from "../../components/Skeleton";
import { PaginatedProducts, ProductSort, productApi } from "../../services/productApi";

type TabKey = "products" | "auctions";
type MainTabKey = "products" | "vendors";

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const SEARCH_DEBOUNCE_MS = 400;

const AdminApprovalsQueue: React.FC = () => {
  const router = useRouter();
  // Only the actions come from the context — the queue itself is paged from the
  // API, so opening this page no longer pulls the whole catalogue.
  const { approveProduct, rejectProduct } = useProducts();
  const [mainTab, setMainTab] = useState<MainTabKey>("products");
  const [tab, setTab] = useState<TabKey>("products");
  const [selectedItem, setSelectedItem] = useState<Product | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  // Which submission is being approved/rejected. The ref is what actually stops
  // a double click — two clicks in one tick would both read a stale state flag.
  const [actingOn, setActingOn] = useState<string | null>(null);
  const actingRef = useRef<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const section = router.query.section;
    if (section === "products" || section === "vendors") {
      setMainTab(section);
    }
  }, [router.query.section]);

  const handleMainTabChange = (nextTab: MainTabKey) => {
    setMainTab(nextTab);
    void router.replace(
      { pathname: router.pathname, query: { ...router.query, section: nextTab } },
      undefined,
      { shallow: true }
    );
  };

  useEffect(() => {
    const queryTab = router.query.tab;
    if (queryTab === "products" || queryTab === "auctions") {
      setTab(queryTab);
    }
  }, [router.query.tab]);

  // ─── Server-side queue ─────────────────────────────────────────────────────
  // The queue is fetched a page at a time rather than filtered out of the whole
  // catalogue in the browser, so it stays usable as submissions pile up.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<ProductSort>("oldest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [queue, setQueue] = useState<PaginatedProducts | null>(null);
  const [rejected, setRejected] = useState<PaginatedProducts | null>(null);
  const [counts, setCounts] = useState({ products: 0, auctions: 0 });
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestIdRef = useRef(0);

  const refreshQueue = useCallback(() => setRefreshKey((prev) => prev + 1), []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Switching tab or filters starts the queue over.
  useEffect(() => {
    setPage(1);
  }, [tab, search, category, sort, pageSize]);


  useEffect(() => {
    if (mainTab !== "products") return;

    const requestId = ++requestIdRef.current;
    setQueueLoading(true);

    const shared = {
      search: search || undefined,
      category: category === "all" ? undefined : category,
      // The Products tab excludes auctions, which have their own tab. Without
      // this an auction awaiting review appeared under both.
      ...(tab === "auctions" ? { productType: "auction" as const } : { isAuction: false }),
      sort,
    } as const;

    Promise.all([
      productApi.listProductsPage({ ...shared, approvalStatus: "pending", page, pageSize }),
      productApi.listProductsPage({ ...shared, approvalStatus: "rejected", page: 1, pageSize: 5 }),
      productApi.listProductsPage({ approvalStatus: "pending", page: 1, pageSize: 1 }),
      productApi.listProductsPage({ approvalStatus: "pending", productType: "auction", page: 1, pageSize: 1 }),
    ])
      .then(([pendingPage, rejectedPage, allPending, pendingAuctionsPage]) => {
        if (requestId !== requestIdRef.current) return;
        setQueue(pendingPage);
        setRejected(rejectedPage);
        setCounts({
          products: allPending.total - pendingAuctionsPage.total,
          auctions: pendingAuctionsPage.total,
        });
        setQueueError(null);
        if (pendingPage.page !== page) setPage(pendingPage.page);
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        setQueue(null);
        setQueueError(err instanceof Error ? err.message : "Failed to load the approvals queue.");
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setQueueLoading(false);
      });
  }, [mainTab, tab, search, category, sort, page, pageSize, refreshKey]);

  useEffect(() => {
    let active = true;
    productApi
      .listFilterOptions()
      .then((options) => {
        if (active) setCategories(options.categories);
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const currentPending = queue?.data ?? [];
  const currentRejected = rejected?.data ?? [];
  const hasQuery = Boolean(search) || category !== "all";

  // A deep link (?productId=…) fetches that one row rather than pulling the
  // whole catalogue in to find it.
  useEffect(() => {
    const productId = router.query.productId;
    const targetId = Array.isArray(productId) ? productId[0] : productId;
    if (!targetId || selectedItem?.id === targetId) return;

    let active = true;
    productApi
      .getProduct(targetId)
      .then((match) => {
        if (!active) return;
        setSelectedItem(match);
        setTab(match.isAuction ? "auctions" : "products");
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [router.query.productId, selectedItem?.id]);

  const openDetails = (item: Product) => {
    setSelectedItem(item);
    void router.replace(
      {
        pathname: router.pathname,
        query: { ...router.query, tab: item.isAuction ? "auctions" : "products", productId: item.id },
      },
      undefined,
      { shallow: true }
    );
  };

  const closeDetails = () => {
    setSelectedItem(null);
    const nextQuery: Record<string, string | string[] | undefined> = { ...router.query };
    delete nextQuery.productId;
    void router.replace(
      {
        pathname: router.pathname,
        query: nextQuery,
      },
      undefined,
      { shallow: true }
    );
  };

  const handleTabChange = (nextTab: TabKey) => {
    setTab(nextTab);
    const nextQuery: Record<string, string | string[] | undefined> = { ...router.query, tab: nextTab };
    delete nextQuery.productId;
    void router.replace(
      {
        pathname: router.pathname,
        query: nextQuery,
      },
      undefined,
      { shallow: true }
    );
  };

  /**
   * One request per click: the id of the item being acted on is held in state
   * and its buttons are disabled while the request is in flight, and the ref
   * blocks a second click landing in the same tick before the re-render.
   */
  const handleApprove = async (item: Product) => {
    if (actingRef.current) return;
    actingRef.current = item.id;
    setActingOn(item.id);

    try {
      await approveProduct(item.id);
      if (selectedItem?.id === item.id) closeDetails();
      setNotice({ tone: "success", message: `"${item.title}" approved and published.` });
      refreshQueue();
    } catch (err) {
      setNotice({
        tone: "error",
        message: err instanceof Error ? err.message : "Failed to approve the submission.",
      });
    } finally {
      actingRef.current = null;
      setActingOn(null);
    }
  };

  const handleReject = async (productId: string) => {
    if (actingRef.current) return;
    actingRef.current = productId;
    setActingOn(productId);

    const item = currentPending.find((entry) => entry.id === productId) || selectedItem;

    try {
      await rejectProduct(productId, rejectReason || "Rejected by admin");
      if (selectedItem?.id === productId) closeDetails();
      setRejectTarget(null);
      setRejectReason("");
      setNotice({ tone: "success", message: `"${item?.title ?? "Submission"}" rejected.` });
      refreshQueue();
    } catch (err) {
      setNotice({
        tone: "error",
        message: err instanceof Error ? err.message : "Failed to reject the submission.",
      });
    } finally {
      actingRef.current = null;
      setActingOn(null);
    }
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; pending: number }[] = [
    {
      key: "products",
      label: "Products",
      icon: <Package className="h-4 w-4" />,
      pending: counts.products,
    },
    {
      key: "auctions",
      label: "Auctions",
      icon: <Gavel className="h-4 w-4" />,
      pending: counts.auctions,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Result of the last approve/reject — the admin previously got no
          confirmation at all, only an alert() when something failed. */}
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-6 top-20 z-[95] flex max-w-sm items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg ${
            notice.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {notice.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notification"
            className="ml-1 shrink-0 opacity-60 hover:opacity-100"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm w-fit">
        <button
          onClick={() => handleMainTabChange("products")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            mainTab === "products" ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Package className="h-4 w-4" />
          Products
        </button>
        <button
          onClick={() => handleMainTabChange("vendors")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            mainTab === "vendors" ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Vendor Profiles
        </button>
      </div>

      {mainTab === "vendors" ? (
        <AdminVendorApprovalsQueue />
      ) : (
      <>
      <section className="rounded-2xl border border-amber-200 bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
            <Clock className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Approvals Queue</h1>
            <p className="mt-0.5 text-sm text-amber-200/70">
              Review new farmer submissions before they go live in the marketplace.
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-4">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center">
            <p className="text-2xl font-bold text-amber-300">{counts.products}</p>
            <p className="text-xs text-amber-200/60">Products Pending</p>
          </div>
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-center">
            <p className="text-2xl font-bold text-cyan-300">{counts.auctions}</p>
            <p className="text-xs text-cyan-200/60">Auctions Pending</p>
          </div>
        </div>
      </section>

      <div className="flex gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm w-fit">
        {tabs.map(({ key, label, icon, pending }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === key ? "bg-amber-500 text-white shadow" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {icon}
            {label}
            {pending > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${tab === key ? "bg-white/30 text-white" : "bg-amber-100 text-amber-700"}`}>
                {pending}
              </span>
            )}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="approvals-search" className="mb-1 block text-sm font-medium text-slate-700">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="approvals-search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Title, vendor, category or ID"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
          <div className="sm:w-52">
            <label htmlFor="approvals-category" className="mb-1 block text-sm font-medium text-slate-700">Category</label>
            <select
              id="approvals-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">All categories</option>
              {categories.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div className="sm:w-48">
            <label htmlFor="approvals-sort" className="mb-1 block text-sm font-medium text-slate-700">Sort by</label>
            <select
              id="approvals-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as ProductSort)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="oldest">Oldest first (longest waiting)</option>
              <option value="newest">Newest first</option>
              <option value="title_asc">Title (A–Z)</option>
            </select>
          </div>
          {hasQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setCategory("all");
                setPage(1);
              }}
              className="text-sm font-medium text-amber-700 hover:text-amber-800"
            >
              Clear
            </button>
          )}
        </div>
      </section>

      {queueError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {queueError}
          <button onClick={refreshQueue} className="ml-2 font-semibold underline">Retry</button>
        </div>
      )}

      {queueLoading && !queue && <SkeletonCards count={3} className="space-y-3" label="Loading submissions awaiting review" />}

      {queue && currentPending.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Awaiting Review ({queue.total})
          </h2>
          <div className="space-y-3">
            {currentPending.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-4 rounded-2xl border border-amber-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={item.images[0]}
                    alt={item.title}
                    className="h-16 w-16 rounded-xl object-cover"
                  />
                  <div>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      By <span className="font-medium">{item.vendorName}</span> | {item.category}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {item.isAuction
                        ? `Starting: ${formatCurrency(item.startingPrice || 0)}`
                        : `Price: ${formatCurrency(item.basePrice || 0)} | Stock: ${item.stock ?? "N/A"}`}
                    </p>
                    {item.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-400">{item.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    Pending Review
                  </span>
                  <button
                    onClick={() => openDetails(item)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Eye className="h-4 w-4" />
                    View Details
                  </button>
                  <button
                    onClick={() => void handleApprove(item)}
                    disabled={actingOn !== null}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actingOn === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {actingOn === item.id ? "Approving…" : "Approve"}
                  </button>
                  <button
                    onClick={() => {
                      setRejectTarget(item.id);
                      setRejectReason("");
                    }}
                    disabled={actingOn !== null}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>

          {queue.totalPages > 1 && (
            <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row">
              <label htmlFor="approvals-page-size" className="flex items-center gap-2 text-sm text-slate-600">
                <span className="font-medium text-slate-700">Per page</span>
                <select
                  id="approvals-page-size"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1"
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <span className="text-slate-500">of {queue.total}</span>
              </label>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  disabled={page <= 1 || queueLoading}
                  aria-label="Previous page"
                  className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </button>
                {buildPageList(page, queue.totalPages).map((entry, idx) =>
                  entry === "gap" ? (
                    <span key={`gap-${idx}`} className="px-2 text-sm text-slate-400">…</span>
                  ) : (
                    <button
                      key={entry}
                      type="button"
                      onClick={() => setPage(entry)}
                      disabled={queueLoading}
                      aria-current={entry === page ? "page" : undefined}
                      className={`min-w-[36px] rounded-lg border px-2 py-1.5 text-sm ${
                        entry === page ? "border-amber-500 bg-amber-500 text-white" : "border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {entry}
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(prev + 1, queue.totalPages))}
                  disabled={page >= queue.totalPages || queueLoading}
                  aria-label="Next page"
                  className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {queue && currentPending.length === 0 && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-400" />
          <p className="font-semibold text-emerald-800">{hasQuery ? "Nothing matches" : "All caught up"}</p>
          <p className="mt-1 text-sm text-emerald-600">
            {hasQuery ? `No pending ${tab} match your search.` : `No pending ${tab} awaiting review.`}
          </p>
        </div>
      )}

      {currentRejected.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recently Rejected ({currentRejected.length})
          </h2>
          <div className="space-y-2">
            {currentRejected.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-red-100 bg-red-50/50 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <img src={item.images[0]} alt={item.title} className="h-12 w-12 rounded-lg object-cover opacity-70" />
                  <div>
                    <p className="font-medium text-slate-700">{item.title}</p>
                    <p className="text-xs text-red-500">
                      <AlertTriangle className="mr-0.5 inline h-3 w-3" />
                      {item.rejectionReason || "Rejected by admin"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openDetails(item)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
                  >
                    View details
                  </button>
                  <button
                    onClick={() => void handleApprove(item)}
                    className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                  >
                    Re-approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-[94] flex items-center justify-center">
          <button className="absolute inset-0 bg-black/50" onClick={closeDetails} />
          <div className="relative max-h-[90vh] w-[95%] max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                  {selectedItem.isAuction ? "Auction review" : "Product review"}
                </p>
                <h3 className="mt-1 text-2xl font-bold text-slate-900">{selectedItem.title}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Submitted by {selectedItem.vendorName}
                </p>
              </div>
              <button onClick={closeDetails} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
              <img
                src={selectedItem.images[0]}
                alt={selectedItem.title}
                className="h-60 w-full rounded-2xl object-cover border border-slate-200"
              />
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Category</p>
                    <p className="mt-1 font-semibold text-slate-900">{selectedItem.category}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Type</p>
                    <p className="mt-1 font-semibold text-slate-900">{selectedItem.productType}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {selectedItem.isAuction ? "Starting price" : "Price"}
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {formatCurrency(selectedItem.startingPrice || selectedItem.basePrice || 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {selectedItem.isAuction ? "Auction quantity" : "Stock"}
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {selectedItem.auctionQuantity || selectedItem.stock || 0}
                    </p>
                  </div>
                  {!selectedItem.isAuction && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Minimum order</p>
                      <p className="mt-1 font-semibold text-slate-900">{selectedItem.minOrderQty || 1}</p>
                    </div>
                  )}
                  {selectedItem.isAuction && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Bid increment</p>
                      <p className="mt-1 font-semibold text-slate-900">{formatCurrency(selectedItem.bidIncrement || 0)}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
                  <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    {selectedItem.description}
                  </p>
                </div>

                {selectedItem.approvalStatus === "rejected" && selectedItem.rejectionReason && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    Last rejection reason: {selectedItem.rejectionReason}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-5">
              <button
                onClick={() => {
                  setRejectTarget(selectedItem.id);
                  setRejectReason(selectedItem.rejectionReason || "");
                }}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Reject
              </button>
              <button
                onClick={() => void handleApprove(selectedItem)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Approve and publish
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center">
          <button
            className="absolute inset-0 bg-black/50"
            onClick={() => setRejectTarget(null)}
          />
          <div className="relative w-[92%] max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Reject Submission</h3>
            <p className="mt-1 text-sm text-gray-500">Provide a reason so the farmer knows what to fix.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Missing details, image quality too low, invalid price."
              rows={3}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setRejectTarget(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleReject(rejectTarget)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default AdminApprovalsQueue;
