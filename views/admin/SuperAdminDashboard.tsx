import React, { useMemo } from "react";
import { BarChart3, Gavel, Package, ShoppingCart, Store, Users } from "lucide-react";
import { useUsers } from "../../context/UsersContext";
import { useProducts } from "../../context/ProductContext";
import { useOrders } from "../../context/OrdersContext";
import { formatCurrency } from "../../utils/helpers";

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

const SuperAdminDashboard: React.FC = () => {
  const { users } = useUsers();
  const { products } = useProducts();
  const { orders } = useOrders();

  const stats = useMemo(() => {
    const appUsers = users.filter((user) => user.userType !== "admin");
    const farmers = appUsers.filter((user) => user.userType === "farmer");
    const customers = appUsers.filter((user) => user.userType === "customer");
    const activeAuctions = products.filter((product) => product.isAuction && product.auctionStatus === "live");
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    return {
      totalUsers: appUsers.length,
      totalFarmers: farmers.length,
      totalCustomers: customers.length,
      totalProducts: products.length,
      totalActiveAuctions: activeAuctions.length,
      totalOrders: orders.length,
      totalRevenue,
    };
  }, [orders, products, users]);

  const recentUsers = users
    .filter((user) => user.userType !== "admin")
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);
  const recentOrders = [...orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  const recentAuctions = products
    .filter((product) => product.isAuction)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-cyan-100 bg-gradient-to-r from-slate-900 via-cyan-900 to-teal-800 p-6 text-white shadow-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-100">Admin Dashboard</p>
        <h1 className="mt-2 text-3xl font-bold">Platform Control Center</h1>
        <p className="mt-2 max-w-3xl text-sm text-cyan-50">Live overview of users, products, auctions, orders, and revenue.</p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Users" value={String(stats.totalUsers)} detail="Farmers + Customers" icon={<Users className="h-5 w-5" />} />
        <StatCard title="Total Farmers" value={String(stats.totalFarmers)} detail="Registered farmer accounts" icon={<Store className="h-5 w-5" />} />
        <StatCard title="Total Customers" value={String(stats.totalCustomers)} detail="Registered customer accounts" icon={<Users className="h-5 w-5" />} />
        <StatCard title="Total Products" value={String(stats.totalProducts)} detail="Retail, wholesale and auctions" icon={<Package className="h-5 w-5" />} />
        <StatCard title="Active Auctions" value={String(stats.totalActiveAuctions)} detail="Currently live auction listings" icon={<Gavel className="h-5 w-5" />} />
        <StatCard title="Total Orders" value={String(stats.totalOrders)} detail="Checkout and auction orders" icon={<ShoppingCart className="h-5 w-5" />} />
        <StatCard title="Total Revenue" value={formatCurrency(stats.totalRevenue)} detail="Aggregate order value" icon={<BarChart3 className="h-5 w-5" />} />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Recent Users</h3>
          <div className="mt-4 space-y-2">
            {recentUsers.map((user) => (
              <div key={user.uid} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <p className="font-semibold text-slate-800">{user.displayName}</p>
                <p className="text-xs text-slate-500">{user.phoneNumber} | {user.city}</p>
                <p className="text-xs text-slate-500">{new Date(user.createdAt).toLocaleString()}</p>
              </div>
            ))}
            {recentUsers.length === 0 && <p className="text-sm text-slate-500">No user activity.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Recent Orders</h3>
          <div className="mt-4 space-y-2">
            {recentOrders.map((order) => (
              <div key={order.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <p className="font-semibold text-slate-800">{order.id}</p>
                <p className="text-xs text-slate-500">{order.customerInfo.fullName} | {order.status}</p>
                <p className="text-xs text-slate-500">{formatCurrency(order.total)}</p>
              </div>
            ))}
            {recentOrders.length === 0 && <p className="text-sm text-slate-500">No order activity.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Recent Auctions</h3>
          <div className="mt-4 space-y-2">
            {recentAuctions.map((auction) => (
              <div key={auction.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <p className="font-semibold text-slate-800">{auction.title}</p>
                <p className="text-xs text-slate-500">{auction.vendorName}</p>
                <p className="text-xs text-slate-500">
                  {(auction.auctionStatus || "live").toUpperCase()} | Highest {formatCurrency(auction.currentHighestBid || auction.startingPrice || 0)}
                </p>
              </div>
            ))}
            {recentAuctions.length === 0 && <p className="text-sm text-slate-500">No auction activity.</p>}
          </div>
        </div>
      </section>
    </div>
  );
};

export default SuperAdminDashboard;
