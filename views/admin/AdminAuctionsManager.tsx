import React, { useMemo, useState } from "react";
import { Eye, Gavel, Search, Trash2, XCircle } from "lucide-react";
import ConfirmModal from "../../components/ConfirmModal";
import { useProducts } from "../../context/ProductContext";
import { formatCurrency } from "../../utils/helpers";

const AdminAuctionsManager: React.FC = () => {
  const { products, closeAuction, cancelAuction, deleteProduct } = useProducts();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [bidModalId, setBidModalId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const auctions = useMemo(
    () =>
      products.filter((product) => product.isAuction).filter((product) => {
        const matchesQuery = `${product.title} ${product.vendorName}`.toLowerCase().includes(query.toLowerCase());
        const status = product.auctionStatus || "live";
        const matchesStatus = statusFilter === "all" || statusFilter === status;
        return matchesQuery && matchesStatus;
      }),
    [products, query, statusFilter]
  );

  const bidAuction = bidModalId ? auctions.find((auction) => auction.id === bidModalId) : null;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-cyan-900 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight">Auctions Management</h1>
        <p className="mt-2 text-sm text-cyan-100">Monitor auction performance, inspect bids, close/cancel, and remove listings.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-3">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search auctions"
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm">
            <option value="all">All Status</option>
            <option value="live">Active</option>
            <option value="ended">Ended</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Auction</th>
              <th className="px-4 py-3 text-left font-semibold">Start Price</th>
              <th className="px-4 py-3 text-left font-semibold">Highest Bid</th>
              <th className="px-4 py-3 text-left font-semibold">Bids</th>
              <th className="px-4 py-3 text-left font-semibold">Start</th>
              <th className="px-4 py-3 text-left font-semibold">End</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {auctions.map((auction) => (
              <tr key={auction.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img src={auction.images[0]} alt={auction.title} className="h-12 w-12 rounded-lg object-cover" />
                    <div>
                      <p className="font-semibold text-slate-800">{auction.title}</p>
                      <p className="text-xs text-slate-500">{auction.vendorName}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{formatCurrency(auction.startingPrice || 0)}</td>
                <td className="px-4 py-3">{formatCurrency(auction.currentHighestBid || 0)}</td>
                <td className="px-4 py-3">{auction.bids?.length || 0}</td>
                <td className="px-4 py-3">{auction.auctionStartTime ? new Date(auction.auctionStartTime).toLocaleString() : "-"}</td>
                <td className="px-4 py-3">{auction.auctionEndTime ? new Date(auction.auctionEndTime).toLocaleString() : "-"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    auction.auctionStatus === "cancelled"
                      ? "bg-red-100 text-red-700"
                      : auction.auctionStatus === "ended"
                        ? "bg-slate-100 text-slate-700"
                        : "bg-blue-100 text-blue-700"
                  }`}>
                    {(auction.auctionStatus || "live").toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setBidModalId(auction.id)} className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        void closeAuction(auction.id).catch(() => {
                          alert("Unable to close auction.");
                        });
                      }}
                      className="rounded-md border border-emerald-300 p-1.5 text-emerald-700 hover:bg-emerald-50"
                      disabled={auction.auctionStatus !== "live"}
                    >
                      <Gavel className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        void cancelAuction(auction.id).catch(() => {
                          alert("Unable to cancel auction.");
                        });
                      }}
                      className="rounded-md border border-amber-300 p-1.5 text-amber-700 hover:bg-amber-50"
                      disabled={auction.auctionStatus !== "live"}
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(auction.id)} className="rounded-md border border-red-300 p-1.5 text-red-700 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {auctions.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">No auctions found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {bidAuction && (
        <div className="fixed inset-0 z-[94]">
          <button className="absolute inset-0 bg-black/40" onClick={() => setBidModalId(null)} />
          <div className="absolute left-1/2 top-1/2 w-[92%] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Bids for {bidAuction.title}</h3>
            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
              {(bidAuction.bids || []).length === 0 && <p className="text-sm text-gray-500">No bids placed yet.</p>}
              {(bidAuction.bids || []).map((bid) => (
                <div key={bid.id} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900">{bid.bidderName}</p>
                    <p className="font-semibold text-emerald-700">{formatCurrency(bid.amount)}</p>
                  </div>
                  <p className="text-xs text-gray-500">{new Date(bid.timestamp).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setBidModalId(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Auction"
        message="Delete this auction permanently?"
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          void deleteProduct(deleteTarget).catch((err) => {
            alert(err instanceof Error ? err.message : "Failed to delete auction.");
          });
          setDeleteTarget(null);
        }}
      />
    </div>
  );
};

export default AdminAuctionsManager;
