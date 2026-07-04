import React, { useState } from "react";
import { BellRing, Clock3, Gavel, Trophy } from "lucide-react";
import { useProducts } from "../../context/ProductContext";
import { useAuth } from "../../context/AuthContext";
import { useOrders } from "../../context/OrdersContext";
import { formatCurrency, getTimeRemaining } from "../../utils/helpers";

const BuyerAuctions: React.FC = () => {
  const { user } = useAuth();
  const { products, placeBid } = useProducts();
  const { notifications, markNotificationRead } = useOrders();
  const [bidDrafts, setBidDrafts] = useState<Record<string, string>>({});
  const auctions = products.filter(
    (product) =>
      product.isAuction &&
      product.approvalStatus === "approved" &&
      product.isActive !== false &&
      product.auctionStatus !== "cancelled"
  );
  const myNotifications = notifications.filter((notification) => notification.userId === user?.uid);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-purple-100 bg-gradient-to-r from-purple-700 to-indigo-700 p-6 text-white">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gavel className="w-6 h-6" />
          Live Auctions
        </h1>
        <p className="text-sm text-purple-100 mt-2">Place bids and track highest bid updates in real time.</p>
      </div>

      {myNotifications.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
            <BellRing className="w-4 h-4 text-amber-600" />
            Notifications
          </h2>
          <div className="space-y-2">
            {myNotifications.map((notification) => (
              <div key={notification.id} className={`rounded-lg px-3 py-2 text-sm ${notification.read ? "bg-gray-50 text-gray-600" : "bg-amber-50 text-amber-800"}`}>
                <p className="font-semibold">{notification.title}</p>
                <p>{notification.message}</p>
                {!notification.read && (
                  <button
                    onClick={() => markNotificationRead(notification.id)}
                    className="mt-1 text-xs underline"
                  >
                    Mark as read
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {auctions.map((auction) => {
          const isEnded = auction.auctionStatus === "ended";
          const timeLeft = auction.auctionEndTime ? getTimeRemaining(auction.auctionEndTime) : null;
          const nextMin = (auction.currentHighestBid || auction.startingPrice || 0) + (auction.bidIncrement || 0);
          return (
            <article key={auction.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-gray-900">{auction.title}</h3>
                  <p className="text-sm text-gray-500">{auction.vendorName}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isEnded ? "bg-slate-100 text-slate-700" : "bg-purple-100 text-purple-700"}`}>
                  {isEnded ? "Ended" : "Live"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Highest Bid</p>
                  <p className="font-bold text-gray-900">{formatCurrency(auction.currentHighestBid || 0)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Bids</p>
                  <p className="font-bold text-gray-900">{auction.bids?.length || 0}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 flex justify-center items-center gap-1"><Clock3 className="w-3 h-3" /> Time</p>
                  <p className="font-bold text-gray-900">{isEnded || !timeLeft ? "Closed" : `${timeLeft.days}d ${timeLeft.hours}h`}</p>
                </div>
              </div>

              {isEnded && auction.winnerBidderName && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800 flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  Winner: {auction.winnerBidderName}
                </div>
              )}

              {!isEnded && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={nextMin}
                      value={bidDrafts[auction.id] || String(nextMin)}
                      onChange={(e) => setBidDrafts((prev) => ({ ...prev, [auction.id]: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <button
                      onClick={async () => {
                        const amount = Number(bidDrafts[auction.id] || nextMin);
                        const result = await placeBid({
                          productId: auction.id,
                          bidderId: user?.uid || "guest_buyer",
                          bidderName: user?.displayName || "Buyer",
                          amount,
                        });
                        alert(result.message);
                      }}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      Place Bid
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">Minimum next bid: {formatCurrency(nextMin)}</p>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default BuyerAuctions;
