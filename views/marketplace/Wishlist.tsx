import React from "react";
import Link from "next/link";
import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import { useWishlist } from "../../context/WishlistContext";
import { useCart } from "../../context/CartContext";
import { formatCurrency } from "../../utils/helpers";

const Wishlist: React.FC = () => {
  const { wishlist, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();

  if (wishlist.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <div className="w-24 h-24 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-6 text-pink-500">
          <Heart className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Your wishlist is empty</h2>
        <p className="text-gray-500 mb-8">Save products to wishlist for quick access later.</p>
        <Link href="/buyer" className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors">
          Browse Marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <section className="rounded-2xl border border-pink-100 bg-gradient-to-r from-pink-600 to-rose-600 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Heart className="w-6 h-6" />
          My Wishlist
        </h1>
        <p className="text-sm text-pink-100 mt-2">{wishlist.length} saved item(s)</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {wishlist.map((product) => (
          <article key={product.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <img src={product.images[0]} alt={product.title} className="w-full h-44 object-cover" />
            <div className="p-4">
              <h3 className="font-bold text-gray-900 line-clamp-2">{product.title}</h3>
              <p className="text-sm text-gray-500 mt-1">{product.vendorName}</p>
              <p className="text-lg font-bold text-gray-900 mt-3">{formatCurrency(product.basePrice || product.currentHighestBid || 0)}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    addToCart(product, product.minOrderQty || 1);
                    removeFromWishlist(product.id);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Add to Cart
                </button>
                <button
                  onClick={() => removeFromWishlist(product.id)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default Wishlist;
