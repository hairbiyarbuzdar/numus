import React from "react";
import { CheckCircle2, X } from "lucide-react";
import { useCart } from "../context/CartContext";

const CartToast: React.FC = () => {
  const { toast, clearToast } = useCart();

  return (
    <div
      className={`fixed right-4 top-20 z-[80] transition-all duration-300 ${
        toast ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0 pointer-events-none"
      }`}
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-lg">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <span>{toast?.message}</span>
        <button
          onClick={clearToast}
          className="rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default CartToast;
