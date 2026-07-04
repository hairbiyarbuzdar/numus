import React from "react";
import { useAuth } from "../../context/AuthContext";
import { OrderStatus, useOrders } from "../../context/OrdersContext";
import { formatCurrency } from "../../utils/helpers";

const ORDER_STATUS_OPTIONS: OrderStatus[] = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"];

const VendorOrders: React.FC = () => {
  const { user } = useAuth();
  const { orders, updateOrderStatus } = useOrders();

  const incoming = orders
    .filter((order) => order.items.some((item) => item.vendorId === user?.uid))
    .map((order) => ({
      ...order,
      vendorItems: order.items.filter((item) => item.vendorId === user?.uid),
    }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Incoming Orders</h1>
      {incoming.length === 0 && <p className="text-gray-500">No incoming orders yet.</p>}
      {incoming.map((order) => {
        const vendorTotal = order.vendorItems.reduce((acc, item) => acc + item.price * item.qty, 0);
        return (
          <article key={order.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-bold text-gray-900">{order.id}</p>
                <p className="text-sm text-gray-500">{order.customerInfo.fullName} • {order.customerInfo.phone}</p>
              </div>
              <select
                value={order.status}
                onChange={(e) => updateOrderStatus(order.id, e.target.value as OrderStatus)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                {ORDER_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              {order.vendorItems.map((item) => (
                <div key={`${order.id}-${item.productId}`} className="flex justify-between text-sm">
                  <span className="text-gray-700">{item.qty}x {item.title}</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(item.price * item.qty)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3 flex justify-between text-sm">
              <span className="text-gray-500">Subtotal for your items</span>
              <span className="font-bold text-gray-900">{formatCurrency(vendorTotal)}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
};

export default VendorOrders;
