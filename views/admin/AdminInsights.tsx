import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { TrendingUp, Users, ShoppingCart, Gavel, Package, DollarSign } from "lucide-react";
import { useUsers } from "../../context/UsersContext";
import { useProducts } from "../../context/ProductContext";
import { useOrders } from "../../context/OrdersContext";
import { formatCurrency } from "../../utils/helpers";

const COLORS = ["#06b6d4", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#f97316"];

const StatTile: React.FC<{ label: string; value: string; sub?: string; icon: React.ReactNode; color: string }> = ({
  label,
  value,
  sub,
  icon,
  color,
}) => (
  <div className={`rounded-xl border bg-white p-4 shadow-sm ${color}`}>
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <div className="text-slate-400">{icon}</div>
    </div>
    <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
  </div>
);

const AdminInsights: React.FC = () => {
  const { users } = useUsers();
  const { products } = useProducts();
  const { orders } = useOrders();

  const appUsers = useMemo(() => users.filter((u) => u.userType !== "admin"), [users]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const farmers = appUsers.filter((u) => u.userType === "farmer").length;
    const customers = appUsers.filter((u) => u.userType === "customer").length;
    const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
    const pendingOrders = orders.filter((o) => o.status === "Pending").length;
    const liveAuctions = products.filter((p) => p.isAuction && p.auctionStatus === "live").length;
    const pendingApprovals = products.filter((p) => p.approvalStatus === "pending").length;
    return { farmers, customers, totalRevenue, pendingOrders, liveAuctions, pendingApprovals };
  }, [appUsers, orders, products]);

  // ── User growth (last 7 days) ──────────────────────────────────────────────
  const userGrowthData = useMemo(() => {
    const days: { day: string; Farmers: number; Customers: number }[] = [];
    const now = Date.now();
    for (let i = 6; i >= 0; i--) {
      const dayStart = now - i * 86400000;
      const dayEnd = dayStart + 86400000;
      const label = new Date(dayStart).toLocaleDateString("en-PK", { weekday: "short" });
      days.push({
        day: label,
        Farmers: appUsers.filter((u) => u.userType === "farmer" && u.createdAt >= dayStart && u.createdAt < dayEnd).length,
        Customers: appUsers.filter((u) => u.userType === "customer" && u.createdAt >= dayStart && u.createdAt < dayEnd).length,
      });
    }
    return days;
  }, [appUsers]);

  // ── Revenue by day (last 7 days) ───────────────────────────────────────────
  const revenueData = useMemo(() => {
    const now = Date.now();
    return Array.from({ length: 7 }, (_, i) => {
      const dayStart = now - (6 - i) * 86400000;
      const dayEnd = dayStart + 86400000;
      const label = new Date(dayStart).toLocaleDateString("en-PK", { weekday: "short" });
      const rev = orders
        .filter((o) => o.createdAt >= dayStart && o.createdAt < dayEnd)
        .reduce((s, o) => s + o.total, 0);
      return { day: label, Revenue: rev };
    });
  }, [orders]);

  // ── Product category distribution ─────────────────────────────────────────
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [products]);

  // ── Order status breakdown ─────────────────────────────────────────────────
  const orderStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [orders]);

  // ── Top farmers by products ────────────────────────────────────────────────
  const topFarmers = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {};
    products.forEach((p) => {
      if (!counts[p.vendorId]) counts[p.vendorId] = { name: p.vendorName, count: 0 };
      counts[p.vendorId].count += 1;
    });
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [products]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-cyan-100 bg-gradient-to-r from-slate-900 via-cyan-950 to-teal-900 p-6 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20">
            <TrendingUp className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Platform Insights</h1>
            <p className="mt-0.5 text-sm text-cyan-100/70">
              Real-time analytics — users, revenue, products, and auction performance.
            </p>
          </div>
        </div>
      </section>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Total Farmers" value={String(stats.farmers)} icon={<Users className="h-4 w-4" />} color="border-emerald-100" />
        <StatTile label="Total Customers" value={String(stats.customers)} icon={<Users className="h-4 w-4" />} color="border-blue-100" />
        <StatTile label="Total Revenue" value={formatCurrency(stats.totalRevenue)} icon={<DollarSign className="h-4 w-4" />} color="border-cyan-100" />
        <StatTile label="Pending Orders" value={String(stats.pendingOrders)} icon={<ShoppingCart className="h-4 w-4" />} color="border-amber-100" />
        <StatTile label="Live Auctions" value={String(stats.liveAuctions)} icon={<Gavel className="h-4 w-4" />} color="border-purple-100" />
        <StatTile label="Awaiting Approval" value={String(stats.pendingApprovals)} icon={<Package className="h-4 w-4" />} color="border-red-100" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* User growth */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-slate-800">User Registrations (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={userGrowthData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Farmers" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Customers" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue trend */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-slate-800">Revenue Trend (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `₨${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Line type="monotone" dataKey="Revenue" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Category pie */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-slate-800">Products by Category</h3>
          {categoryData.length === 0 ? (
            <p className="text-sm text-slate-400">No products yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Order status */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-slate-800">Orders by Status</h3>
          {orderStatusData.length === 0 ? (
            <p className="text-sm text-slate-400">No orders yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={orderStatusData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top farmers */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-slate-800">Top Farmers by Listings</h3>
          {topFarmers.length === 0 ? (
            <p className="text-sm text-slate-400">No farmers yet.</p>
          ) : (
            <div className="space-y-3">
              {topFarmers.map((farmer, i) => (
                <div key={farmer.name} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{farmer.name}</p>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(100, (farmer.count / (topFarmers[0]?.count || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-600">{farmer.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminInsights;
