import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { CircleMinus, CirclePlus, ShoppingCart, Trash2, X } from "lucide-react";
import { useCart } from "../context/CartContext";
import { formatCurrency } from "../utils/helpers";

const CartDrawer: React.FC = () => {
  const router = useRouter();
  const { cart, cartTotal, isCartOpen, closeCart, updateQty, removeFromCart } = useCart();

  useEffect(() => {
    if (!isCartOpen) return;

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeCart();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onEsc);
    };
  }, [closeCart, isCartOpen]);

  return (
    <div
      className={`fixed inset-0 z-[70] transition-all duration-300 ${isCartOpen ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!isCartOpen}
    >
      <div
        className={`absolute inset-0 bg-black/55 transition-opacity duration-300 ${isCartOpen ? "opacity-100" : "opacity-0"}`}
        onClick={closeCart}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className={`absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl transition-transform duration-300 ease-out ${
          isCartOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="border-b border-gray-200 px-5 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Your Cart</h2>
              <button
                onClick={closeCart}
                className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                aria-label="Close cart"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {cart.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              <div className="mb-4 rounded-full bg-emerald-50 p-4 text-emerald-600">
                <ShoppingCart className="h-8 w-8" />
              </div>
              <p className="text-lg font-bold text-gray-900">Your cart is empty</p>
              <p className="mt-1 text-sm text-gray-500">Add products to see them here.</p>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {cart.map((item) => (
                  <article key={item.productId} className="rounded-xl border border-gray-200 p-3">
                    <div className="flex gap-3">
                      <img src={item.image} alt={item.title} className="h-16 w-16 rounded-lg object-cover" loading="lazy" decoding="async" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-gray-900">{item.title}</p>
                        <p className="text-sm text-emerald-700">{formatCurrency(item.price)} each</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-2 py-1">
                            <button
                              onClick={() => updateQty(item.productId, item.qty - 1)}
                              className="text-gray-500 hover:text-red-600"
                              aria-label="Decrease quantity"
                            >
                              <CircleMinus className="h-4 w-4" />
                            </button>
                            <span className="w-6 text-center text-sm font-semibold text-gray-900">{item.qty}</span>
                            <button
                              onClick={() => updateQty(item.productId, item.qty + 1)}
                              className="text-gray-500 hover:text-emerald-600"
                              aria-label="Increase quantity"
                            >
                              <CirclePlus className="h-4 w-4" />
                            </button>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.productId)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-right text-sm font-bold text-gray-900">
                      Subtotal: {formatCurrency(item.price * item.qty)}
                    </div>
                  </article>
                ))}
              </div>
              <div className="border-t border-gray-200 p-4">
                <div className="mb-4 flex items-center justify-between text-base font-bold text-gray-900">
                  <span>Overall Total</span>
                  <span>{formatCurrency(cartTotal)}</span>
                </div>
                <button
                  onClick={() => {
                    closeCart();
                    void router.push("/buyer/checkout");
                  }}
                  className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white transition-colors hover:bg-emerald-700"
                >
                  Checkout
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
};

export default CartDrawer;
