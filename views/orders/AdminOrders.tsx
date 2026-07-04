import React, { useMemo, useState } from "react";
import { OrderStatus, useOrders } from "../../context/OrdersContext";
import { formatCurrency } from "../../utils/helpers";
import { Search } from "lucide-react";

const ORDER_STATUS_OPTIONS: OrderStatus[] = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"];

const AdminOrders: React.FC = () => {
  const { orders, updateOrderStatus } = useOrders();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const matchesQuery = `${order.id} ${order.customerInfo.fullName} ${order.paymentMethod}`
          .toLowerCase()
          .includes(query.toLowerCase());
        const matchesStatus = statusFilter === "all" || order.status === statusFilter;
        return matchesQuery && matchesStatus;
      }),
    [orders, query, statusFilter]
  );

  const activeOrder = activeOrderId ? orders.find((order) => order.id === activeOrderId) : null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-cyan-900 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight">Orders Management</h1>
        <p className="mt-2 text-sm text-cyan-100">Review all customer and auction orders, then update fulfillment status.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-3">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by order ID, customer, payment method"
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | OrderStatus)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
          >
            <option value="all">All Status</option>
            {ORDER_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
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
                    value={order.status}
                    onChange={(e) => updateOrderStatus(order.id, e.target.value as OrderStatus)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
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
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">No orders found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {activeOrder && (
        <div className="fixed inset-0 z-[94]">
          <button className="absolute inset-0 bg-black/40" onClick={() => setActiveOrderId(null)} />
          <div className="absolute left-1/2 top-1/2 w-[92%] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-2xl">
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
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
