import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Gavel,
  Package,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateTime, getTimeRemaining } from '../../utils/helpers';
import { SkeletonLines, SkeletonStats } from '../../components/Skeleton';
import { Product } from '../../types';
import { productApi } from '../../services/productApi';
import { OrderRecord, OrderSummary, orderApi } from '../../services/orderApi';

interface DashboardData {
  summary: OrderSummary;
  productCount: number;
  auctionCount: number;
  pendingApproval: number;
  outOfStock: number;
  recentOrders: OrderRecord[];
  endingAuctions: Product[];
}

const StatCard: React.FC<{
  label: string;
  value: string;
  detail?: string;
  icon: React.ReactNode;
  accent: string;
  href?: string;
}> = ({ label, value, detail, icon, accent, href }) => {
  const card = (
    <div className="h-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <span className={accent}>{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {detail && <p className="mt-1 text-xs text-gray-500">{detail}</p>}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{card}</Link> : card;
};

const statusClass = (status: string) => {
  if (status === 'Pending' || status === 'Confirmed') return 'bg-amber-100 text-amber-700';
  if (status === 'Processing' || status === 'Shipped') return 'bg-blue-100 text-blue-700';
  if (status === 'Delivered') return 'bg-emerald-100 text-emerald-700';
  if (status === 'Cancelled') return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-700';
};

const VendorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!user?.uid) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);

    // Counts come back as `total` on a one-row page, so the dashboard never
    // pulls a full list just to count it. Everything is vendor-scoped by the API.
    Promise.all([
      orderApi.getSummary(),
      productApi.listProductsPage({ page: 1, pageSize: 1 }),
      productApi.listProductsPage({ page: 1, pageSize: 1, productType: 'auction' }),
      productApi.listProductsPage({ page: 1, pageSize: 1, approvalStatus: 'pending' }),
      productApi.listProductsPage({ page: 1, pageSize: 1, status: 'out_of_stock' }),
      orderApi.listOrdersPage({ page: 1, pageSize: 5, sort: 'newest' }),
      productApi.listProductsPage({ page: 1, pageSize: 3, productType: 'auction', auctionState: 'active', sort: 'ending_soonest' }),
    ])
      .then(([summary, products, auctions, pending, outOfStock, orders, ending]) => {
        if (requestId !== requestIdRef.current) return;
        setData({
          summary,
          productCount: products.total,
          auctionCount: auctions.total,
          pendingApproval: pending.total,
          outOfStock: outOfStock.total,
          recentOrders: orders.data,
          endingAuctions: ending.data,
        });
        setError(null);
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        setData(null);
        setError(err instanceof Error ? err.message : 'Failed to load your dashboard.');
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [user?.uid, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((prev) => prev + 1), []);

  const firstName = (user?.displayName || 'there').split(' ')[0];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-700 to-teal-600 p-6 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">Vendor Dashboard</p>
        <h1 className="mt-2 text-3xl font-bold">Welcome back, {firstName}</h1>
        <p className="mt-2 text-sm text-emerald-50">
          Your listings, auctions, orders and earnings at a glance.
        </p>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button onClick={refresh} className="ml-2 font-semibold underline">Retry</button>
        </div>
      )}

      {loading && !data && <SkeletonStats count={6} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" label="Loading your dashboard" />}

      {data && (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Earnings"
              value={formatCurrency(data.summary.earnedRevenue)}
              detail="From delivered orders, your items only"
              icon={<Wallet className="h-5 w-5" />}
              accent="text-emerald-600"
              href="/vendor/finance"
            />
            <StatCard
              label="Pipeline"
              value={formatCurrency(data.summary.grossRevenue - data.summary.earnedRevenue)}
              detail="Ordered but not yet delivered"
              icon={<TrendingUp className="h-5 w-5" />}
              accent="text-teal-600"
              href="/vendor/finance"
            />
            <StatCard
              label="Orders"
              value={String(data.summary.totalOrders)}
              detail={`${data.summary.byStatus.Pending} pending · ${data.summary.byStatus.Delivered} delivered`}
              icon={<ShoppingBag className="h-5 w-5" />}
              accent="text-blue-600"
              href="/vendor/orders"
            />
            <StatCard
              label="Products"
              value={String(data.productCount)}
              detail={data.outOfStock > 0 ? `${data.outOfStock} out of stock` : 'All in stock'}
              icon={<Package className="h-5 w-5" />}
              accent="text-indigo-600"
              href="/vendor/products"
            />
            <StatCard
              label="Auctions"
              value={String(data.auctionCount)}
              detail="Across all statuses"
              icon={<Gavel className="h-5 w-5" />}
              accent="text-purple-600"
              href="/vendor/auctions"
            />
            <StatCard
              label="Awaiting approval"
              value={String(data.pendingApproval)}
              detail={data.pendingApproval > 0 ? 'Not visible to buyers yet' : 'Nothing waiting'}
              icon={<Clock className="h-5 w-5" />}
              accent="text-amber-600"
              href="/vendor/products"
            />
          </section>

          {(data.pendingApproval > 0 || data.outOfStock > 0 || data.summary.byStatus.Pending > 0) && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                <AlertTriangle className="h-4 w-4" /> Needs your attention
              </p>
              <ul className="mt-2 space-y-1 text-sm text-amber-800">
                {data.summary.byStatus.Pending > 0 && (
                  <li>
                    <Link href="/vendor/orders" className="underline">
                      {data.summary.byStatus.Pending} order{data.summary.byStatus.Pending === 1 ? '' : 's'} waiting to be confirmed
                    </Link>
                  </li>
                )}
                {data.outOfStock > 0 && (
                  <li>
                    <Link href="/vendor/products" className="underline">
                      {data.outOfStock} product{data.outOfStock === 1 ? '' : 's'} marked out of stock
                    </Link>
                  </li>
                )}
                {data.pendingApproval > 0 && (
                  <li>
                    <Link href="/vendor/products" className="underline">
                      {data.pendingApproval} listing{data.pendingApproval === 1 ? '' : 's'} awaiting admin approval
                    </Link>
                  </li>
                )}
              </ul>
            </section>
          )}

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Recent orders</h2>
                <Link href="/vendor/orders" className="flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800">
                  View all <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="mt-4 space-y-2">
                {data.recentOrders.length === 0 && (
                  <p className="text-sm text-gray-500">No orders yet. They will appear here as buyers order your products.</p>
                )}
                {data.recentOrders.map((order) => {
                  const items = order.items.filter((item) => item.vendorId === user?.uid);
                  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
                  return (
                    <div key={order.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{order.id}</p>
                        <p className="truncate text-xs text-gray-500">
                          {order.customerInfo.fullName} · {formatDateTime(order.createdAt)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-gray-900">{formatCurrency(total)}</p>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(order.status)}`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Auctions ending soonest</h2>
                <Link href="/vendor/auctions" className="flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800">
                  View all <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="mt-4 space-y-2">
                {data.endingAuctions.length === 0 && (
                  <p className="text-sm text-gray-500">No live auctions right now.</p>
                )}
                {data.endingAuctions.map((auction) => {
                  const left = auction.auctionEndTime ? getTimeRemaining(auction.auctionEndTime) : null;
                  return (
                    <div key={auction.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{auction.title}</p>
                        <p className="text-xs text-gray-500">
                          {auction.bids?.length || 0} bid{(auction.bids?.length || 0) === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-purple-700">
                          {formatCurrency(auction.currentHighestBid || auction.startingPrice || 0)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {left ? `${left.days}d ${left.hours}h left` : 'Ended'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </>
      )}

      {loading && data && <SkeletonLines lines={1} className="opacity-0" label="Refreshing" />}
    </div>
  );
};

export default VendorDashboard;
