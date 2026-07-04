import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { CalendarDays, CheckCircle2, Clock3, Package2 } from "lucide-react";
import { useOrders } from "../../context/OrdersContext";
import { formatCurrency } from "../../utils/helpers";

const OrderConfirmation: React.FC = () => {
  const router = useRouter();
  const { orders } = useOrders();
  const orderIdParam = router.query.orderId;
  const orderId = Array.isArray(orderIdParam) ? orderIdParam[0] : orderIdParam;
  const order = orderId ? orders.find((record) => record.id === orderId) : undefined;

  if (!order) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Order not found</h1>
        <p className="mt-2 text-sm text-gray-500">We could not load this order confirmation.</p>
        <Link href="/buyer/orders" className="mt-6 inline-block rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">
          View My Orders
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-700 to-teal-600 p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-white/20 p-2">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Order Confirmed</h1>
            <p className="text-sm text-emerald-100">Your order has been placed successfully.</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Order ID</p>
            <p className="mt-1 font-mono text-sm font-bold text-gray-900">{order.id}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Order Status</p>
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
              <Clock3 className="h-3.5 w-3.5" />
              {order.status}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Order Date</p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-gray-900">
              <CalendarDays className="h-4 w-4 text-emerald-600" />
              {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          {order.items.map((item) => (
            <div key={`${order.id}-${item.productId}`} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
              <span className="text-gray-700">
                {item.qty}x {item.title}
              </span>
              <span className="font-semibold text-gray-900">{formatCurrency(item.qty * item.price)}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
          <p className="inline-flex items-center gap-2 text-sm text-gray-500">
            <Package2 className="h-4 w-4 text-emerald-600" />
            Total items: {order.items.length}
          </p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(order.total)}</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/buyer/orders" className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">
            View Orders
          </Link>
          <Link href="/buyer" className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">
            Continue Shopping
          </Link>
        </div>
      </section>
    </div>
  );
};

export default OrderConfirmation;
