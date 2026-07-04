import React from "react";
import { PackageSearch } from "lucide-react";
import { useOrders } from "../../context/OrdersContext";
import { useAuth } from "../../context/AuthContext";
import { formatCurrency } from "../../utils/helpers";

const statusClass = (status: string) => {
  if (status === "Pending" || status === "Confirmed") return "bg-amber-100 text-amber-700";
  if (status === "Processing" || status === "Shipped") return "bg-blue-100 text-blue-700";
  if (status === "Delivered") return "bg-emerald-100 text-emerald-700";
  if (status === "Cancelled") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
};

const BuyerOrders: React.FC = () => {
  const { user } = useAuth();
  const { orders, updateOrderStatus } = useOrders();
  const myOrders = orders.filter((order) => order.customerId === user?.uid);

  if (myOrders.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-400">
          <PackageSearch className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">No orders yet</h2>
        <p className="text-gray-500">Your placed orders will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
      {myOrders.map((order) => (
        <article key={order.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-sm text-gray-500">Order ID</p>
              <p className="font-bold text-gray-900">{order.id}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(order.status)}`}>
                {order.status}
              </span>
              {(order.status === "Pending" || order.status === "Confirmed") && (
                <button
                  onClick={() => updateOrderStatus(order.id, "Cancelled")}
                  className="text-xs px-2.5 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={`${order.id}-${item.productId}`} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{item.qty}x {item.title}</span>
                <span className="font-semibold text-gray-900">{formatCurrency(item.price * item.qty)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 pt-3 flex justify-between text-sm">
            <span className="text-gray-500">Total</span>
            <span className="font-bold text-gray-900">{formatCurrency(order.total)}</span>
          </div>
        </article>
      ))}
    </div>
  );
};

export default BuyerOrders;
