import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from "next/router";
import { formatCurrency, calculateBulkPrice, formatDateTime, getTimeRemaining, hasAuctionStarted } from '../../utils/helpers';
import { ShoppingCart, Gavel, Clock, ArrowLeft, CheckCircle, AlertCircle, TrendingUp, Zap } from 'lucide-react';
import { Product } from '../../types';
import { useCart } from '../../context/CartContext';
import { useProducts } from '../../context/ProductContext';
import { useAuth } from '../../context/AuthContext';
import { useWishlist } from '../../context/WishlistContext';
import { Skeleton, SkeletonLines } from '../../components/Skeleton';

const ProductDetails: React.FC = () => {
  const router = useRouter();
  const idParam = router.query.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const { addToCart } = useCart();
  const { products, loaded, ensureProducts, placeBid } = useProducts();
  const { user } = useAuth();
  const { addToWishlist, removeFromWishlist, isWishlisted } = useWishlist();
  const [selectedQty, setSelectedQty] = useState<number>(1);
  const [justAdded, setJustAdded] = useState(false);
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

  // The catalogue is fetched when a product page opens, not at login.
  useEffect(() => {
    void ensureProducts();
  }, [ensureProducts]);

  useEffect(() => {
    if (!product) return;
    setSelectedQty(product.minOrderQty || 1);
    if (product.isAuction && product.currentHighestBid) {
      setBidAmount(product.currentHighestBid + (product.bidIncrement || 1000));
    }
  }, [product]);

  // Changing the quantity (or opening a different product) means the buyer wants
  // to add again, so the button goes back to "Add to Order".
  useEffect(() => {
    setJustAdded(false);
  }, [selectedQty, product?.id]);

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

  // Until the catalogue has loaded, "not found" is indistinguishable from
  // "not fetched yet" — show the skeleton rather than a false negative.
  if (!loaded) {
    return (
      <div className="space-y-6 p-2">
        <SkeletonLines lines={1} className="max-w-[160px]" label="Loading product" />
        <div className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="h-80 w-full rounded-2xl" />
          <SkeletonLines lines={6} />
        </div>
      </div>
    );
  }

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
    setJustAdded(true);
  };

  const handleWishlist = async () => {
    if (isWishlisted(product.id)) {
      await removeFromWishlist(product.id);
      return;
    }
    const result = await addToWishlist(product);
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
                onClick={() => void handleWishlist()}
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
                    {!hasAuctionStarted(product) ? (
                      <p className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                        Bidding opens {formatDateTime(product.auctionStartTime)}. You can place a bid once the auction starts.
                      </p>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>
                </div>
              ) : (
                // RETAIL / WHOLESALE UI
                <div className="space-y-6">
                  {product.status === 'out_of_stock' && (
                    <span className="inline-flex w-fit items-center rounded-md bg-gray-900 px-2.5 py-1 text-xs font-bold text-white">
                      Out of Stock
                    </span>
                  )}
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

                  {/* The field and the button share one height token and sit on
                      the same baseline — the button used to align to the top of
                      the row, level with the label rather than the input. */}
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-end gap-4">
                      <div className="w-32 shrink-0">
                        <label htmlFor="product-quantity" className="block text-xs font-semibold text-gray-500 mb-1">
                          Quantity
                        </label>
                        <input
                          id="product-quantity"
                          type="number"
                          min={product.minOrderQty || 1}
                          value={selectedQty}
                          onChange={(e) => setSelectedQty(Math.max(product.minOrderQty || 1, parseInt(e.target.value) || 1))}
                          className="h-12 w-full px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold text-center"
                        />
                      </div>
                      {justAdded && product.status !== 'out_of_stock' ? (
                        <button
                          onClick={() => void router.push('/buyer/cart')}
                          className="h-12 flex-grow bg-gray-900 text-white rounded-lg font-bold hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-lg shadow-gray-900/20"
                        >
                          <CheckCircle className="w-5 h-5 text-emerald-400" /> View Cart
                        </button>
                      ) : (
                        <button
                          onClick={handleAddToCart}
                          disabled={product.status === 'out_of_stock'}
                          className="h-12 flex-grow bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
                        >
                          <ShoppingCart className="w-5 h-5" /> {product.status === 'out_of_stock' ? 'Out of Stock' : 'Add to Order'}
                        </button>
                      )}
                    </div>
                    <p className="w-32 text-xs text-center text-gray-500 mt-1">
                      Min Order: {product.minOrderQty || 1}
                    </p>
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
