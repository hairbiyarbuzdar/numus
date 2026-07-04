import React, { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Bell, UserPlus, Package, ShoppingCart, Gavel, CheckCheck, Filter } from "lucide-react";
import { useUsers } from "../../context/UsersContext";
import { useProducts } from "../../context/ProductContext";
import { useOrders } from "../../context/OrdersContext";
import { formatCurrency } from "../../utils/helpers";

type NotifType = "all" | "users" | "products" | "orders" | "auctions";

interface DerivedNotif {
  id: string;
  type: "user" | "product" | "order" | "auction";
  icon: React.ReactNode;
  title: string;
  detail: string;
  time: number;
  urgent?: boolean;
  actionHref?: string;
  actionLabel?: string;
}

const timeAgo = (ts: number) => {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
};

const AdminNotificationsCenter: React.FC = () => {
  const router = useRouter();
  const { users } = useUsers();
  const { products } = useProducts();
  const { orders, notifications: userNotifications, markNotificationRead } = useOrders();
  const [filter, setFilter] = useState<NotifType>("all");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const markRead = (id: string) => setReadIds((prev) => new Set(prev).add(id));
  const markAllRead = () => {
    const allIds = derived.map((n) => n.id);
    setReadIds(new Set(allIds));
  };

  const derived = useMemo<DerivedNotif[]>(() => {
    const list: DerivedNotif[] = [];

    const cutoff = Date.now() - 3 * 86400000;
    users
      .filter((u) => u.userType !== "admin" && u.createdAt > cutoff)
      .forEach((u) => {
        list.push({
          id: `user_${u.uid}`,
          type: "user",
          icon: <UserPlus className="h-4 w-4" />,
          title: `New ${u.userType === "farmer" ? "Farmer" : "Customer"} Registered`,
          detail: `${u.displayName} | ${u.city || "Unknown city"} | ${u.phoneNumber}`,
          time: u.createdAt,
        });
      });

    products
      .filter((p) => !p.isAuction && p.approvalStatus === "pending")
      .forEach((p) => {
        list.push({
          id: `prod_${p.id}`,
          type: "product",
          icon: <Package className="h-4 w-4" />,
          title: "New Product Added",
          detail: `"${p.title}" by ${p.vendorName} | ${p.category} | ${formatCurrency(p.basePrice || 0)}`,
          time: p.createdAt || Date.now(),
          urgent: true,
          actionHref: `/admin/approvals?tab=products&productId=${p.id}`,
          actionLabel: "Open approvals",
        });
      });

    products
      .filter((p) => p.isAuction && p.approvalStatus === "pending")
      .forEach((p) => {
        list.push({
          id: `auc_${p.id}`,
          type: "auction",
          icon: <Gavel className="h-4 w-4" />,
          title: "New Auction Added",
          detail: `"${p.title}" by ${p.vendorName} | Starting ${formatCurrency(p.startingPrice || 0)}`,
          time: p.createdAt || Date.now(),
          urgent: true,
          actionHref: `/admin/approvals?tab=auctions&productId=${p.id}`,
          actionLabel: "Open approvals",
        });
      });

    const orderCutoff = Date.now() - 2 * 86400000;
    orders
      .filter((o) => o.createdAt > orderCutoff)
      .forEach((o) => {
        list.push({
          id: `ord_${o.id}`,
          type: "order",
          icon: <ShoppingCart className="h-4 w-4" />,
          title: "New Order Placed",
          detail: `${o.id} | ${o.customerInfo.fullName} | ${formatCurrency(o.total)} | ${o.status}`,
          time: o.createdAt,
        });
      });

    return list.sort((a, b) => b.time - a.time);
  }, [users, products, orders]);

  const filtered = useMemo(() => {
    if (filter === "all") return derived;
    const map: Record<NotifType, DerivedNotif["type"] | null> = {
      all: null,
      users: "user",
      products: "product",
      orders: "order",
      auctions: "auction",
    };
    return derived.filter((n) => n.type === map[filter]);
  }, [derived, filter]);

  const unreadCount = derived.filter((n) => !readIds.has(n.id)).length;
  const urgentCount = derived.filter((n) => n.urgent && !readIds.has(n.id)).length;

  const iconBg: Record<DerivedNotif["type"], string> = {
    user: "bg-blue-100 text-blue-600",
    product: "bg-amber-100 text-amber-600",
    order: "bg-emerald-100 text-emerald-600",
    auction: "bg-purple-100 text-purple-600",
  };

  const filterTabs: { key: NotifType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "users", label: "Users" },
    { key: "products", label: "Products" },
    { key: "auctions", label: "Auctions" },
    { key: "orders", label: "Orders" },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-blue-100 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-6 text-white shadow-lg">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
              <Bell className="h-5 w-5 text-blue-400" />
              {urgentCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {urgentCount}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold">Notifications</h1>
              <p className="mt-0.5 text-sm text-blue-200/70">
                Platform activity: users, approvals, orders, and auctions.
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-2 text-center">
            <p className="text-xl font-bold text-red-300">{urgentCount}</p>
            <p className="text-xs text-red-200/60">Urgent</p>
          </div>
          <div className="rounded-lg border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-center">
            <p className="text-xl font-bold text-blue-300">{unreadCount}</p>
            <p className="text-xs text-blue-200/60">Unread</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-center">
            <p className="text-xl font-bold text-white">{derived.length}</p>
            <p className="text-xs text-white/40">Total</p>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm w-fit max-w-full">
        <Filter className="ml-1 h-4 w-4 shrink-0 text-slate-400" />
        {filterTabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              filter === key ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center">
          <Bell className="mx-auto mb-3 h-10 w-10 text-slate-200" />
          <p className="font-semibold text-slate-400">No notifications in this category</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((notif) => {
            const isRead = readIds.has(notif.id);
            return (
              <div
                key={notif.id}
                onClick={() => {
                  markRead(notif.id);
                  if (notif.actionHref) {
                    void router.push(notif.actionHref);
                  }
                }}
                className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-all hover:shadow-sm ${
                  isRead
                    ? "border-slate-100 bg-white opacity-60"
                    : notif.urgent
                    ? "border-amber-200 bg-amber-50/60"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconBg[notif.type]}`}>
                  {notif.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold ${isRead ? "text-slate-500" : "text-slate-900"}`}>
                      {notif.title}
                    </p>
                    {notif.urgent && !isRead && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                        Action needed
                      </span>
                    )}
                    {!isRead && !notif.urgent && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{notif.detail}</p>
                  {notif.actionLabel && <p className="mt-2 text-xs font-semibold text-blue-600">{notif.actionLabel}</p>}
                </div>
                <span className="shrink-0 text-xs text-slate-400">{timeAgo(notif.time)}</span>
              </div>
            );
          })}
        </div>
      )}

      {userNotifications.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            User Notifications (Auction / System)
          </h2>
          <div className="space-y-2">
            {userNotifications.slice(0, 10).map((n) => (
              <div
                key={n.id}
                onClick={() => markNotificationRead(n.id)}
                className={`flex cursor-pointer items-start gap-4 rounded-xl border p-3 transition-all hover:shadow-sm ${
                  n.read ? "border-slate-100 bg-white opacity-60" : "border-cyan-100 bg-cyan-50/50"
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-cyan-600">
                  <Bell className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{n.message}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-slate-400">{timeAgo(n.createdAt)}</span>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-cyan-500" />}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default AdminNotificationsCenter;
