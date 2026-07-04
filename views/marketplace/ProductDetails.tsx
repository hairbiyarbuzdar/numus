import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from "next/router";
import { formatCurrency, calculateBulkPrice, getTimeRemaining } from '../../utils/helpers';
import { ShoppingCart, Gavel, Clock, ArrowLeft, CheckCircle, AlertCircle, TrendingUp, Zap } from 'lucide-react';
import { Product } from '../../types';
import { useCart } from '../../context/CartContext';
import { useProducts } from '../../context/ProductContext';
import { useAuth } from '../../context/AuthContext';
import { useWishlist } from '../../context/WishlistContext';

const ProductDetails: React.FC = () => {
  const router = useRouter();
  const idParam = router.query.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const { addToCart } = useCart();
  const { products, placeBid } = useProducts();
  const { user } = useAuth();
  const { addToWishlist, removeFromWishlist, isWishlisted } = useWishlist();
  const [selectedQty, setSelectedQty] = useState<number>(1);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, minutes: number, seconds: number } | null>(null);
  const product: Product | null = useMemo(
    () =>
      id
        ? products.find(
            (p) => p.id === id && p.approvalStatus === "approved" && p.isActive !== false && p.auctionStatus !== "cancelled"
          ) || null
        : null,
    [id, products]
  );

  useEffect(() => {
    if (!product) return;
    setSelectedQty(product.minOrderQty || 1);
    if (product.isAuction && product.currentHighestBid) {
      setBidAmount(product.currentHighestBid + (product.bidIncrement || 1000));
    }
  }, [product]);

  useEffect(() => {
    if (!product?.auctionEndTime) {
      setTimeLeft(null);
      return;
    }

    setTimeLeft(getTimeRemaining(product.auctionEndTime));
    const timer = setInterval(() => {
      setTimeLeft(getTimeRemaining(product.auctionEndTime!));
    }, 1000);

    return () => clearInterval(timer);
  }, [product?.auctionEndTime]);

  if (!product) return <div className="p-8 text-gray-600">Product is unavailable or has been removed.</div>;

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    void router.push("/buyer");
  };

  const currentPrice = useMemo(
    () => calculateBulkPrice(selectedQty, product.basePrice || 0, product.bulkTiers),
    [product.basePrice, product.bulkTiers, selectedQty]
  );
  const subtotal = useMemo(() => currentPrice * selectedQty, [currentPrice, selectedQty]);
  const minimumNextBid = useMemo(
    () => (product.currentHighestBid || product.startingPrice || 0) + (product.bidIncrement || 0),
    [product.currentHighestBid, product.startingPrice, product.bidIncrement]
  );

  const handlePlaceBid = async () => {
    if (!product?.isAuction) return;

    if (bidAmount < minimumNextBid) {
      alert(`Bid too low. Next valid bid is at least ${formatCurrency(minimumNextBid)}.`);
      return;
    }

    const bidResult = await placeBid({
      productId: product.id,
      bidderId: user?.uid || 'guest_buyer',
      bidderName: user?.displayName || 'Guest Buyer',
      amount: bidAmount,
    });
    if (!bidResult.ok) {
      alert(bidResult.message);
      return;
    }

    setBidAmount(bidAmount + (product.bidIncrement || 0));
    alert(`Bid of ${formatCurrency(bidAmount)} placed successfully!`);
  };

  const handleBuyNow = () => {
    if (!product.buyNowPrice) return;
    
    // Pass the fixed buy now price to cart
    addToCart(
      { ...product, basePrice: product.buyNowPrice }, // Ensure basePrice is set to buyNowPrice for cart logic
      1, 
      product.buyNowPrice
    );
    void router.push('/buyer/checkout');
  };

  const handleAddToCart = () => {
    addToCart(product, selectedQty);
  };

  const handleWishlist = () => {
    if (isWishlisted(product.id)) {
      removeFromWishlist(product.id);
      return;
    }
    const result = addToWishlist(product);
    if (!result.ok) {
      alert(result.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button onClick={handleBack} className="flex items-center text-gray-500 hover:text-gray-900 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Marketplace
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          
          {/* Image Gallery Section */}
          <div className="p-6 lg:p-8 bg-gray-50 border-b lg:border-b-0 lg:border-r border-gray-200">
            <div className="aspect-square bg-white rounded-lg border border-gray-200 overflow-hidden mb-4 relative">
               {product.isAuction && (
                 <div className="absolute top-4 left-4 bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 z-10 shadow-lg">
                   <Clock className="w-3 h-3" /> Live Auction
                 </div>
               )}
              <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" loading="eager" fetchPriority="high" decoding="async" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {product.images.map((img, idx) => (
                <div key={idx} className="aspect-square bg-white rounded-md border border-gray-200 overflow-hidden cursor-pointer hover:ring-2 hover:ring-emerald-500">
                  <img src={img} alt="Thumbnail" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                </div>
              ))}
            </div>
          </div>

          {/* Info Section */}
          <div className="p-6 lg:p-8">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className={`
                  px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide
                  ${product.isAuction ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}
                `}>
                  {product.productType}
                </span>
                <span className="text-gray-400 text-sm">|</span>
                <span className="text-emerald-600 text-sm font-medium">{product.vendorName}</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.title}</h1>
              <button
                onClick={handleWishlist}
                className={`mb-2 text-sm px-3 py-1.5 rounded-lg border ${isWishlisted(product.id) ? 'border-pink-200 text-pink-600 bg-pink-50' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              >
                {isWishlisted(product.id) ? 'Remove from Wishlist' : 'Add to Wishlist'}
              </button>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                 <span>Ref: #{product.id.toUpperCase()}</span>
                 <span className="flex items-center text-yellow-500">
                   ★ {product.rating} ({product.reviewsCount} reviews)
                 </span>
              </div>
            </div>

            <p className="text-gray-600 mb-8 leading-relaxed">
              {product.description}
            </p>

            {/* Pricing Logic Section */}
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 mb-6">
              {product.isAuction ? (
                // AUCTION UI
                <div className="space-y-6">
                  <div className="flex flex-wrap justify-between items-center gap-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Current Highest Bid</p>
                      <p className="text-3xl font-bold text-purple-700">{formatCurrency(product.currentHighestBid || 0)}</p>
                    </div>
                    {timeLeft && (
                      <div className="text-right">
                         <p className="text-sm text-gray-500 mb-1 flex items-center justify-end gap-1"><Clock className="w-3 h-3"/> Ends in</p>
                         <div className="flex gap-2 font-mono text-lg font-bold text-gray-900">
                           <span className="bg-white px-2 py-1 rounded border shadow-sm min-w-[40px] text-center">{timeLeft.days}d</span>
                           <span className="bg-white px-2 py-1 rounded border shadow-sm min-w-[40px] text-center">{timeLeft.hours}h</span>
                           <span className="bg-white px-2 py-1 rounded border shadow-sm min-w-[40px] text-center">{timeLeft.minutes}m</span>
                         </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Buy Now Option */}
                  {product.buyNowPrice && (
                    <div className="bg-white p-4 rounded-lg border border-purple-100 flex items-center justify-between shadow-sm">
                      <div>
                        <p className="text-xs text-gray-500 font-bold uppercase">Buy Now Price</p>
                        <p className="text-xl font-bold text-gray-900">{formatCurrency(product.buyNowPrice)}</p>
                      </div>
                      <button 
                        onClick={handleBuyNow}
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg font-bold text-sm hover:bg-black transition-colors flex items-center gap-2"
                      >
                        <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" /> Buy Now
                      </button>
                    </div>
                  )}

                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-gray-500" /> Bid History
                    </h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                      {(product.bids || []).length > 0 ? (
                        product.bids?.map(bid => (
                          <div key={bid.id} className="flex justify-between text-sm">
                            <span className="text-gray-600">{bid.bidderName}</span>
                            <span className="font-mono font-medium">{formatCurrency(bid.amount)}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No bids yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Your Maximum Bid</label>
                    <div className="flex gap-2">
                      <div className="relative flex-grow">
                        <span className="absolute left-3 top-3 text-gray-500 font-bold">Rs</span>
                        <input 
                          type="number" 
                          value={bidAmount}
                          onChange={(e) => setBidAmount(Number(e.target.value))}
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none font-bold text-lg"
                        />
                      </div>
                      <button 
                        onClick={handlePlaceBid}
                        className="bg-purple-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-purple-700 transition-colors flex items-center gap-2"
                      >
                        <Gavel className="w-5 h-5" /> Place Bid
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Minimum bid increment: {formatCurrency(product.bidIncrement || 0)}. Next bid must be at least {formatCurrency(minimumNextBid)}.
                    </p>
                  </div>
                </div>
              ) : (
                // RETAIL / WHOLESALE UI
                <div className="space-y-6">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Price per unit</p>
                      <p className="text-3xl font-bold text-gray-900">{formatCurrency(currentPrice)}</p>
                      {product.productType === 'wholesale' && selectedQty >= (product.bulkTiers?.[0]?.qty || 999) && (
                         <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded mt-1 inline-block">Bulk Savings Applied</span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Subtotal</p>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(subtotal)}</p>
                    </div>
                  </div>

                  {/* Bulk Tiers Table */}
                  {product.bulkTiers && product.bulkTiers.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200 p-3 text-sm">
                      <p className="font-semibold text-gray-700 mb-2 text-xs uppercase">Volume Pricing (MOQ)</p>
                      <div className="grid grid-cols-3 gap-2">
                        {product.bulkTiers.map((tier) => (
                           <div key={tier.qty} className={`text-center p-2 rounded border transition-colors ${selectedQty >= tier.qty ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                              <div className="font-bold text-lg">{tier.qty}+</div>
                              <div className="text-xs">units</div>
                              <div className="font-medium mt-1">{formatCurrency(tier.price)}</div>
                           </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-200 flex gap-4">
                    <div className="w-32">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Quantity</label>
                      <input 
                        type="number" 
                        min={product.minOrderQty || 1}
                        value={selectedQty}
                        onChange={(e) => setSelectedQty(Math.max(product.minOrderQty || 1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold text-center"
                      />
                      <p className="text-xs text-center text-gray-500 mt-1">Min Order: {product.minOrderQty}</p>
                    </div>
                    <div className="flex-grow flex items-start">
                       <button 
                        onClick={handleAddToCart}
                        className="w-full h-[50px] bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                       >
                         <ShoppingCart className="w-5 h-5" /> Add to Order
                       </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Vendor Info / Trust Badges */}
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
               <div className="flex items-center gap-2">
                 <CheckCircle className="w-4 h-4 text-emerald-500" />
                 <span>Verified Vendor</span>
               </div>
               <div className="flex items-center gap-2">
                 <AlertCircle className="w-4 h-4 text-blue-500" />
                 <span>Buyer Protection</span>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;
