import React from 'react';
import Link from "next/link";
import { useRouter } from "next/router";
import {
  ArrowRight,
  CircleMinus,
  CirclePlus,
  ShoppingBag,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { formatCurrency } from '../../utils/helpers';

const Cart: React.FC = () => {
  const { cart, removeFromCart, updateQty, cartTotal, cartCount } = useCart();
  const router = useRouter();
  const deliveryFee = cart.length > 0 ? 500 : 0;
  const grandTotal = cartTotal + deliveryFee;

  if (cart.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center px-4">
        <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-500">
          <ShoppingCart className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
        <p className="text-gray-500 mb-8">Looks like you haven't added any products yet.</p>
        <Link href="/buyer" className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors">
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-0">
      <section className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-lg mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingBag className="w-6 h-6" />
          Your Cart
        </h1>
        <p className="text-sm text-emerald-50 mt-2">
          {cartCount} item{cartCount > 1 ? 's' : ''} ready for checkout.
        </p>
      </section>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-grow space-y-4">
          {cart.map((item) => (
            <article key={item.productId} className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex flex-col md:flex-row gap-4 md:items-center">
                <img src={item.image} alt={item.title} className="w-full md:w-24 h-48 md:h-24 rounded-xl object-cover border border-gray-100" />

                <div className="flex-grow">
                  <h3 className="font-bold text-gray-900 text-base sm:text-lg">{item.title}</h3>
                  <p className="text-sm text-gray-500">Sold by {item.vendorName}</p>
                  <div className="mt-2 text-sm text-emerald-600 font-semibold">
                    Price per item: {formatCurrency(item.price)}
                  </div>
                </div>

                <div className="flex items-center justify-between md:flex-col md:items-end gap-3">
                  <div className="flex items-center gap-2 border border-gray-300 rounded-xl px-2 py-1">
                    <button
                      onClick={() => updateQty(item.productId, item.qty - 1)}
                      className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <CircleMinus className="w-5 h-5" />
                    </button>
                    <span className="w-8 text-center font-semibold text-gray-900">{item.qty}</span>
                    <button
                      onClick={() => updateQty(item.productId, item.qty + 1)}
                      className="p-1 text-gray-500 hover:text-emerald-600 transition-colors"
                      aria-label="Increase quantity"
                    >
                      <CirclePlus className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-gray-500">Item total</p>
                    <p className="font-bold text-gray-900">{formatCurrency(item.price * item.qty)}</p>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 hover:bg-red-50 rounded-lg transition-colors"
                    aria-label="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="w-full lg:w-96">
          <aside className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm sticky top-24">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h3>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatCurrency(cartTotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Delivery Fee</span>
                <span>{formatCurrency(deliveryFee)}</span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between font-bold text-lg text-gray-900">
                <span>Overall Total</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            <button
              onClick={() => { void router.push('/buyer/checkout'); }}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
            >
              Checkout <ArrowRight className="w-4 h-4" />
            </button>

            <Link href="/buyer" className="block text-center text-sm text-gray-500 mt-4 hover:underline">
              Continue Shopping
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Cart;
