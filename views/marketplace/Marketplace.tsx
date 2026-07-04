import React, { useMemo } from 'react';
import Link from "next/link";
import { Search, Filter, Gavel, Tag, Star } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';
import { Product } from '../../types';
import { useProducts } from '../../context/ProductContext';
import { useWishlist } from '../../context/WishlistContext';

const ProductCard: React.FC<{ product: Product }> = React.memo(({ product }) => {
  const { addToWishlist, removeFromWishlist, isWishlisted } = useWishlist();
  const wishlisted = isWishlisted(product.id);
  return (
  <Link href={`/buyer/product/${product.id}`} className="group">
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
      <div className="relative h-48 overflow-hidden bg-gray-100">
        <img 
          src={product.images[0]} 
          alt={product.title} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (wishlisted) {
                removeFromWishlist(product.id);
                return;
              }
              addToWishlist(product);
            }}
            className={`px-2 py-1 rounded-md text-xs font-bold shadow-sm ${wishlisted ? 'bg-pink-100 text-pink-700' : 'bg-white/90 text-gray-700'}`}
          >
            {wishlisted ? 'Wishlisted' : 'Wishlist'}
          </button>
          {product.productType === 'auction' ? (
            <span className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
              <Gavel className="w-3 h-3" /> Live Auction
            </span>
          ) : product.productType === 'wholesale' ? (
              <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
              <Tag className="w-3 h-3" /> Wholesale
            </span>
          ) : null}
        </div>
      </div>
      
      <div className="p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
          <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide truncate pr-2">{product.category}</p>
          <div className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" /> {product.rating}
          </div>
        </div>
        
        <h3 className="font-bold text-gray-900 mb-1 line-clamp-2 group-hover:text-emerald-700 transition-colors">
          {product.title}
        </h3>
        <p className="text-sm text-gray-500 mb-4">{product.vendorName}</p>
        
        <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500">
              {product.isAuction ? 'Current Bid' : product.productType === 'wholesale' ? 'Bulk from' : 'Price'}
            </p>
            <p className="font-bold text-lg text-gray-900">
              {product.isAuction 
                ? formatCurrency(product.currentHighestBid || 0)
                : formatCurrency(product.basePrice || 0)
              }
            </p>
          </div>
          <button className="px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg group-hover:bg-emerald-600 transition-colors">
            View
          </button>
        </div>
      </div>
    </div>
  </Link>
  );
});

const Marketplace: React.FC = () => {
  const { products } = useProducts();
  const visibleProducts = useMemo(
    () => products.filter((p) => p.approvalStatus === "approved" && p.isActive !== false && p.auctionStatus !== "cancelled"),
    [products]
  );
  const auctions = useMemo(() => visibleProducts.filter((p) => p.isAuction), [visibleProducts]);
  const wholesale = useMemo(() => visibleProducts.filter((p) => p.productType === "wholesale"), [visibleProducts]);
  const featured = useMemo(() => visibleProducts.filter((p) => p.productType === "retail").slice(0, 4), [visibleProducts]);

  return (
    <div className="space-y-12 pb-12">
      {/* Header & Search */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Marketplace</h1>
            <p className="text-gray-500 mt-2">Sourcing premium agricultural products from Pakistan's top farms.</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search for wheat, rice, tractors..." 
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 md:pb-0">
            <select className="px-4 py-2.5 border border-gray-300 rounded-lg bg-white min-w-[140px] focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option>Category</option>
              <option>Crops</option>
              <option>Livestock</option>
              <option>Machinery</option>
            </select>
            <button className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <span>Filter</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Auctions Section */}
      {auctions.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Gavel className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-900">Live Auctions</h2>
            <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">LIVE</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {auctions.map(product => <ProductCard key={product.id} product={product} />)}
          </div>
        </section>
      )}

      {/* Wholesale Section */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <Tag className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Wholesale Deals (MOQ)</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {wholesale.map(product => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>

       {/* Featured Retail Section */}
       <section>
        <div className="flex items-center gap-2 mb-6">
          <Star className="w-6 h-6 text-yellow-500" />
          <h2 className="text-2xl font-bold text-gray-900">Featured Products</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featured.map(product => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>
    </div>
  );
};

export default Marketplace;

