import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { CheckCircle2, XCircle, Clock, Gavel, Package, AlertTriangle, Eye } from "lucide-react";
import { useProducts } from "../../context/ProductContext";
import { Product } from "../../types";
import { formatCurrency } from "../../utils/helpers";

type TabKey = "products" | "auctions";

const AdminApprovalsQueue: React.FC = () => {
  const router = useRouter();
  const { products, approveProduct, rejectProduct } = useProducts();
  const [tab, setTab] = useState<TabKey>("products");
  const [selectedItem, setSelectedItem] = useState<Product | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    const queryTab = router.query.tab;
    if (queryTab === "products" || queryTab === "auctions") {
      setTab(queryTab);
    }
  }, [router.query.tab]);

  const pendingProducts = useMemo(
    () => products.filter((p) => !p.isAuction && p.approvalStatus === "pending"),
    [products]
  );

  const pendingAuctions = useMemo(
    () => products.filter((p) => p.isAuction && p.approvalStatus === "pending"),
    [products]
  );

  const rejectedProducts = useMemo(
    () => products.filter((p) => !p.isAuction && p.approvalStatus === "rejected"),
    [products]
  );

  const rejectedAuctions = useMemo(
    () => products.filter((p) => p.isAuction && p.approvalStatus === "rejected"),
    [products]
  );

  const currentPending = tab === "products" ? pendingProducts : pendingAuctions;
  const currentRejected = tab === "products" ? rejectedProducts : rejectedAuctions;

  useEffect(() => {
    const productId = router.query.productId;
    const targetId = Array.isArray(productId) ? productId[0] : productId;
    if (!targetId) return;

    const match = products.find((product) => product.id === targetId);
    if (!match) return;
    setSelectedItem(match);
    if (match.isAuction) {
      setTab("auctions");
    } else {
      setTab("products");
    }
  }, [products, router.query.productId]);

  const openDetails = (item: Product) => {
    setSelectedItem(item);
    void router.replace(
      {
        pathname: router.pathname,
        query: { ...router.query, tab: item.isAuction ? "auctions" : "products", productId: item.id },
      },
      undefined,
      { shallow: true }
    );
  };

  const closeDetails = () => {
    setSelectedItem(null);
    const nextQuery: Record<string, string | string[] | undefined> = { ...router.query };
    delete nextQuery.productId;
    void router.replace(
      {
        pathname: router.pathname,
        query: nextQuery,
      },
      undefined,
      { shallow: true }
    );
  };

  const handleTabChange = (nextTab: TabKey) => {
    setTab(nextTab);
    const nextQuery: Record<string, string | string[] | undefined> = { ...router.query, tab: nextTab };
    delete nextQuery.productId;
    void router.replace(
      {
        pathname: router.pathname,
        query: nextQuery,
      },
      undefined,
      { shallow: true }
    );
  };

  const handleApprove = async (productId: string) => {
    try {
      await approveProduct(productId);
      if (selectedItem?.id === productId) {
        closeDetails();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve product.");
    }
  };

  const handleReject = async (productId: string) => {
    try {
      await rejectProduct(productId, rejectReason || "Rejected by admin");
      if (selectedItem?.id === productId) {
        closeDetails();
      }
      setRejectTarget(null);
      setRejectReason("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reject product.");
    }
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; pending: number }[] = [
    {
      key: "products",
      label: "Products",
      icon: <Package className="h-4 w-4" />,
      pending: pendingProducts.length,
    },
    {
      key: "auctions",
      label: "Auctions",
      icon: <Gavel className="h-4 w-4" />,
      pending: pendingAuctions.length,
    },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-amber-200 bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
            <Clock className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Approvals Queue</h1>
            <p className="mt-0.5 text-sm text-amber-200/70">
              Review new farmer submissions before they go live in the marketplace.
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-4">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center">
            <p className="text-2xl font-bold text-amber-300">{pendingProducts.length}</p>
            <p className="text-xs text-amber-200/60">Products Pending</p>
          </div>
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-center">
            <p className="text-2xl font-bold text-cyan-300">{pendingAuctions.length}</p>
            <p className="text-xs text-cyan-200/60">Auctions Pending</p>
          </div>
        </div>
      </section>

      <div className="flex gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm w-fit">
        {tabs.map(({ key, label, icon, pending }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === key ? "bg-amber-500 text-white shadow" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {icon}
            {label}
            {pending > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${tab === key ? "bg-white/30 text-white" : "bg-amber-100 text-amber-700"}`}>
                {pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {currentPending.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Awaiting Review ({currentPending.length})
          </h2>
          <div className="space-y-3">
            {currentPending.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-4 rounded-2xl border border-amber-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={item.images[0]}
                    alt={item.title}
                    className="h-16 w-16 rounded-xl object-cover"
                  />
                  <div>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      By <span className="font-medium">{item.vendorName}</span> | {item.category}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {item.isAuction
                        ? `Starting: ${formatCurrency(item.startingPrice || 0)}`
                        : `Price: ${formatCurrency(item.basePrice || 0)} | Stock: ${item.stock ?? "N/A"}`}
                    </p>
                    {item.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-400">{item.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    Pending Review
                  </span>
                  <button
                    onClick={() => openDetails(item)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Eye className="h-4 w-4" />
                    View Details
                  </button>
                  <button
                    onClick={() => void handleApprove(item.id)}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      setRejectTarget(item.id);
                      setRejectReason("");
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {currentPending.length === 0 && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-400" />
          <p className="font-semibold text-emerald-800">All caught up</p>
          <p className="mt-1 text-sm text-emerald-600">No pending {tab} awaiting review.</p>
        </div>
      )}

      {currentRejected.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recently Rejected ({currentRejected.length})
          </h2>
          <div className="space-y-2">
            {currentRejected.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-red-100 bg-red-50/50 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <img src={item.images[0]} alt={item.title} className="h-12 w-12 rounded-lg object-cover opacity-70" />
                  <div>
                    <p className="font-medium text-slate-700">{item.title}</p>
                    <p className="text-xs text-red-500">
                      <AlertTriangle className="mr-0.5 inline h-3 w-3" />
                      {item.rejectionReason || "Rejected by admin"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openDetails(item)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
                  >
                    View details
                  </button>
                  <button
                    onClick={() => void handleApprove(item.id)}
                    className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                  >
                    Re-approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-[94] flex items-center justify-center">
          <button className="absolute inset-0 bg-black/50" onClick={closeDetails} />
          <div className="relative max-h-[90vh] w-[95%] max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                  {selectedItem.isAuction ? "Auction review" : "Product review"}
                </p>
                <h3 className="mt-1 text-2xl font-bold text-slate-900">{selectedItem.title}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Submitted by {selectedItem.vendorName}
                </p>
              </div>
              <button onClick={closeDetails} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
              <img
                src={selectedItem.images[0]}
                alt={selectedItem.title}
                className="h-60 w-full rounded-2xl object-cover border border-slate-200"
              />
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Category</p>
                    <p className="mt-1 font-semibold text-slate-900">{selectedItem.category}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Type</p>
                    <p className="mt-1 font-semibold text-slate-900">{selectedItem.productType}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {selectedItem.isAuction ? "Starting price" : "Price"}
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {formatCurrency(selectedItem.startingPrice || selectedItem.basePrice || 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {selectedItem.isAuction ? "Auction quantity" : "Stock"}
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {selectedItem.auctionQuantity || selectedItem.stock || 0}
                    </p>
                  </div>
                  {!selectedItem.isAuction && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Minimum order</p>
                      <p className="mt-1 font-semibold text-slate-900">{selectedItem.minOrderQty || 1}</p>
                    </div>
                  )}
                  {selectedItem.isAuction && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Bid increment</p>
                      <p className="mt-1 font-semibold text-slate-900">{formatCurrency(selectedItem.bidIncrement || 0)}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
                  <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    {selectedItem.description}
                  </p>
                </div>

                {selectedItem.approvalStatus === "rejected" && selectedItem.rejectionReason && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    Last rejection reason: {selectedItem.rejectionReason}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-5">
              <button
                onClick={() => {
                  setRejectTarget(selectedItem.id);
                  setRejectReason(selectedItem.rejectionReason || "");
                }}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Reject
              </button>
              <button
                onClick={() => void handleApprove(selectedItem.id)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Approve and publish
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center">
          <button
            className="absolute inset-0 bg-black/50"
            onClick={() => setRejectTarget(null)}
          />
          <div className="relative w-[92%] max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Reject Submission</h3>
            <p className="mt-1 text-sm text-gray-500">Provide a reason so the farmer knows what to fix.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Missing details, image quality too low, invalid price."
              rows={3}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setRejectTarget(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleReject(rejectTarget)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminApprovalsQueue;
