import React, { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Gavel, Package, ShoppingCart, Store, Users } from "lucide-react";
import { AUCTION_STATUS_LABELS, formatCurrency, formatDateTime, getAuctionDisplayStatus } from "../../utils/helpers";
import { SkeletonLines, SkeletonStats } from "../../components/Skeleton";
import { Product } from "../../types";
import { PaginatedUsers, userApi } from "../../services/userApi";
import { PaginatedProducts, productApi } from "../../services/productApi";
import { OrderSummary, PaginatedOrders, orderApi } from "../../services/orderApi";

const SECTION_PAGE_SIZE_OPTIONS = [5, 10, 25];

const StatCard: React.FC<{ title: string; value: string; detail: string; icon: React.ReactNode }> = ({ title, value, detail, icon }) => (
  <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <div className="text-cyan-700">{icon}</div>
    </div>
    <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    <p className="mt-2 text-xs text-slate-500">{detail}</p>
  </article>
);

/** Prev/next with a page size, sized for a dashboard card rather than a table. */
const SectionPager: React.FC<{
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  loading: boolean;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  label: string;
}> = ({ page, totalPages, total, pageSize, loading, onPage, onPageSize, label }) => (
  <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
    <label className="flex items-center gap-1.5 text-xs text-slate-500">
      <span className="sr-only">{label} per page</span>
      <select
        value={pageSize}
        onChange={(e) => onPageSize(Number(e.target.value))}
        className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs"
        aria-label={`${label} per page`}
      >
        {SECTION_PAGE_SIZE_OPTIONS.map((size) => (
          <option key={size} value={size}>{size}</option>
        ))}
      </select>
      <span>of {total}</span>
    </label>

    <div className="flex items-center gap-1">
      <span className="mr-1 text-xs text-slate-500">Page {page}/{totalPages}</span>
      <button
        type="button"
        onClick={() => onPage(Math.max(page - 1, 1))}
        disabled={page <= 1 || loading}
        aria-label={`Previous page of ${label}`}
        className="rounded border border-slate-300 p-1 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onPage(Math.min(page + 1, totalPages))}
        disabled={page >= totalPages || loading}
        aria-label={`Next page of ${label}`}
        className="rounded border border-slate-300 p-1 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
);

/** One independently paged dashboard section. */
function useSection<T>(fetcher: (page: number, pageSize: number) => Promise<T>, deps: unknown[] = []) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(SECTION_PAGE_SIZE_OPTIONS[0]);
  const [result, setResult] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    fetcher(page, pageSize)
      .then((response) => {
        if (requestId !== requestIdRef.current) return;
        setResult(response);
        setError(null);
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        setResult(null);
        setError(err instanceof Error ? err.message : "Failed to load.");
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, ...deps]);

  return { result, loading, error, page, setPage, pageSize, setPageSize };
}

interface PlatformStats {
  totalUsers: number;
  farmers: number;
  customers: number;
  products: number;
  activeAuctions: number;
  orders: OrderSummary;
}

const SuperAdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Totals come from one-row pages, so the dashboard never downloads a list
  // just to count it.
  useEffect(() => {
    let active = true;
    Promise.all([
      userApi.listUsersPage({ page: 1, pageSize: 1 }),
      userApi.listUsersPage({ page: 1, pageSize: 1, userType: "farmer" }),
      userApi.listUsersPage({ page: 1, pageSize: 1, userType: "customer" }),
      productApi.listProductsPage({ page: 1, pageSize: 1 }),
      productApi.listProductsPage({ page: 1, pageSize: 1, productType: "auction", auctionState: "active" }),
      orderApi.getSummary(),
    ])
      .then(([all, farmers, customers, products, auctions, orders]) => {
        if (!active) return;
        setStats({
          // Admin accounts are staff, not platform users.
          totalUsers: farmers.total + customers.total,
          farmers: farmers.total,
          customers: customers.total,
          products: products.total,
          activeAuctions: auctions.total,
          orders,
        });
        setStatsError(null);
      })
      .catch((err) => {
        if (!active) return;
        setStats(null);
        setStatsError(err instanceof Error ? err.message : "Failed to load platform statistics.");
      });
    return () => {
      active = false;
    };
  }, []);

  const users = useSection<PaginatedUsers>(
    useCallback((page, pageSize) => userApi.listUsersPage({ page, pageSize, sort: "newest" }), [])
  );

  const auctions = useSection<PaginatedProducts>(
    useCallback(
      (page, pageSize) => productApi.listProductsPage({ page, pageSize, productType: "auction", sort: "newest" }),
      []
    )
  );

  const orders = useSection<PaginatedOrders>(
    useCallback((page, pageSize) => orderApi.listOrdersPage({ page, pageSize, sort: "newest" }), [])
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-cyan-100 bg-gradient-to-r from-slate-900 via-cyan-900 to-teal-800 p-6 text-white shadow-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-100">Admin Dashboard</p>
        <h1 className="mt-2 text-3xl font-bold">Platform Control Center</h1>
        <p className="mt-2 max-w-3xl text-sm text-cyan-50">Live overview of users, products, auctions, orders, and revenue.</p>
      </section>

      {statsError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{statsError}</div>
      )}

      {!stats && !statsError && (
        <SkeletonStats count={7} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" label="Loading platform statistics" />
      )}

      {stats && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Users" value={String(stats.totalUsers)} detail="Farmers + Customers" icon={<Users className="h-5 w-5" />} />
          <StatCard title="Total Farmers" value={String(stats.farmers)} detail="Registered farmer accounts" icon={<Store className="h-5 w-5" />} />
          <StatCard title="Total Customers" value={String(stats.customers)} detail="Registered customer accounts" icon={<Users className="h-5 w-5" />} />
          <StatCard title="Total Products" value={String(stats.products)} detail="Retail, wholesale and auctions" icon={<Package className="h-5 w-5" />} />
          <StatCard title="Active Auctions" value={String(stats.activeAuctions)} detail="Currently live auction listings" icon={<Gavel className="h-5 w-5" />} />
          <StatCard title="Total Orders" value={String(stats.orders.totalOrders)} detail="Checkout and auction orders" icon={<ShoppingCart className="h-5 w-5" />} />
          <StatCard title="Total Revenue" value={formatCurrency(stats.orders.grossRevenue)} detail="Aggregate order value" icon={<BarChart3 className="h-5 w-5" />} />
        </section>
      )}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Recent Users</h3>
          <div className="mt-4 space-y-2">
            {users.loading && !users.result && <SkeletonLines lines={4} label="Loading recent users" />}
            {users.error && <p className="text-sm text-red-600">{users.error}</p>}
            {users.result?.data.map((user) => (
              <div key={user.uid} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <p className="font-semibold text-slate-800">{user.displayName}</p>
                <p className="text-xs text-slate-500">{user.phoneNumber || user.email} | {user.city || "—"}</p>
                <p className="text-xs text-slate-500">{formatDateTime(user.createdAt)}</p>
              </div>
            ))}
            {users.result && users.result.data.length === 0 && <p className="text-sm text-slate-500">No user activity.</p>}
          </div>
          {users.result && users.result.total > 0 && (
            <SectionPager
              page={users.result.page}
              totalPages={users.result.totalPages}
              total={users.result.total}
              pageSize={users.pageSize}
              loading={users.loading}
              onPage={users.setPage}
              onPageSize={(size) => {
                users.setPageSize(size);
                users.setPage(1);
              }}
              label="Users"
            />
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Recent Orders</h3>
          <div className="mt-4 space-y-2">
            {orders.loading && !orders.result && <SkeletonLines lines={4} label="Loading recent orders" />}
            {orders.error && <p className="text-sm text-red-600">{orders.error}</p>}
            {orders.result?.data.map((order) => (
              <div key={order.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <p className="font-semibold text-slate-800">{order.id}</p>
                <p className="text-xs text-slate-500">{order.customerInfo.fullName} | {order.status}</p>
                <p className="text-xs text-slate-500">{formatCurrency(order.total)}</p>
              </div>
            ))}
            {orders.result && orders.result.data.length === 0 && <p className="text-sm text-slate-500">No order activity.</p>}
          </div>
          {orders.result && orders.result.total > 0 && (
            <SectionPager
              page={orders.result.page}
              totalPages={orders.result.totalPages}
              total={orders.result.total}
              pageSize={orders.pageSize}
              loading={orders.loading}
              onPage={orders.setPage}
              onPageSize={(size) => {
                orders.setPageSize(size);
                orders.setPage(1);
              }}
              label="Orders"
            />
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Recent Auctions</h3>
          <div className="mt-4 space-y-2">
            {auctions.loading && !auctions.result && <SkeletonLines lines={4} label="Loading recent auctions" />}
            {auctions.error && <p className="text-sm text-red-600">{auctions.error}</p>}
            {auctions.result?.data.map((auction: Product) => (
              <div key={auction.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <p className="font-semibold text-slate-800">{auction.title}</p>
                <p className="text-xs text-slate-500">{auction.vendorName}</p>
                <p className="text-xs text-slate-500">
                  {AUCTION_STATUS_LABELS[getAuctionDisplayStatus(auction)].toUpperCase()} | Highest {formatCurrency(auction.currentHighestBid || auction.startingPrice || 0)}
                </p>
              </div>
            ))}
            {auctions.result && auctions.result.data.length === 0 && <p className="text-sm text-slate-500">No auction activity.</p>}
          </div>
          {auctions.result && auctions.result.total > 0 && (
            <SectionPager
              page={auctions.result.page}
              totalPages={auctions.result.totalPages}
              total={auctions.result.total}
              pageSize={auctions.pageSize}
              loading={auctions.loading}
              onPage={auctions.setPage}
              onPageSize={(size) => {
                auctions.setPageSize(size);
                auctions.setPage(1);
              }}
              label="Auctions"
            />
          )}
        </div>
      </section>
    </div>
  );
};

export default SuperAdminDashboard;
