import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Eye, Loader2, UserCheck } from "lucide-react";
import { vendorProfileService, VendorProfileRecord } from "../../services/vendorProfileService";
import Modal from "../../components/Modal";

const AdminVendorApprovalsQueue: React.FC = () => {
  const [queue, setQueue] = useState<VendorProfileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<VendorProfileRecord | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await vendorProfileService.getQueue();
      setQueue(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vendor approvals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, []);

  const handleApprove = async (vendorId: string) => {
    setBusyId(vendorId);
    try {
      await vendorProfileService.approve(vendorId);
      setQueue((prev) => prev.filter((v) => v.vendorId !== vendorId));
      if (selected?.vendorId === vendorId) setSelected(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve vendor.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (vendorId: string) => {
    setBusyId(vendorId);
    try {
      await vendorProfileService.reject(vendorId, rejectReason || "Rejected by admin");
      setQueue((prev) => prev.filter((v) => v.vendorId !== vendorId));
      if (selected?.vendorId === vendorId) setSelected(null);
      setRejectTarget(null);
      setRejectReason("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reject vendor.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-cyan-200 bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20">
            <UserCheck className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Vendor Profile Approvals</h1>
            <p className="mt-0.5 text-sm text-cyan-200/70">
              Review vendor CNIC, bank, and warehouse details before granting product access.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <div className="w-fit rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-center">
            <p className="text-2xl font-bold text-cyan-300">{queue.length}</p>
            <p className="text-xs text-cyan-200/60">Vendors Pending</p>
          </div>
        </div>
      </section>

      {queue.length === 0 ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-400" />
          <p className="font-semibold text-emerald-800">All caught up</p>
          <p className="mt-1 text-sm text-emerald-600">No vendor profiles awaiting review.</p>
        </div>
      ) : (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Awaiting Review ({queue.length})
          </h2>
          <div className="space-y-3">
            {queue.map((vendor) => (
              <div
                key={vendor.vendorId}
                className="flex flex-col gap-4 rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">{vendor.displayName}</p>
                  <p className="text-xs text-slate-500">
                    {vendor.email} {vendor.city && `| ${vendor.city}`}
                  </p>
                  {vendor.submittedAt && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      Submitted {new Date(vendor.submittedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
                    Pending Review
                  </span>
                  <button
                    onClick={() => setSelected(vendor)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Eye className="h-4 w-4" />
                    View Details
                  </button>
                  <button
                    onClick={() => void handleApprove(vendor.vendorId)}
                    disabled={busyId === vendor.vendorId}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => { setRejectTarget(vendor.vendorId); setRejectReason(""); }}
                    disabled={busyId === vendor.vendorId}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
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

      <Modal open={!!selected} onClose={() => setSelected(null)} label="Vendor profile review" size="max-w-3xl">
        {selected && (
          <div className="max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-600">Vendor profile review</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-900">{selected.displayName}</h3>
                <p className="mt-1 text-sm text-slate-500">{selected.email}</p>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">
                Close
              </button>
            </div>

            {selected.profile && (
              <div className="mt-6 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">CNIC Front</p>
                    {selected.profile.cnicFrontImage ? (
                      <img src={selected.profile.cnicFrontImage} alt="CNIC front" className="h-32 w-full rounded-lg border object-cover" />
                    ) : (
                      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-xs text-slate-400">No image</div>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">CNIC Back</p>
                    {selected.profile.cnicBackImage ? (
                      <img src={selected.profile.cnicBackImage} alt="CNIC back" className="h-32 w-full rounded-lg border object-cover" />
                    ) : (
                      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-xs text-slate-400">No image</div>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">CNIC Number</p>
                    <p className="mt-1 font-semibold text-slate-900">{selected.profile.cnicNumber}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">CNIC Name</p>
                    <p className="mt-1 font-semibold text-slate-900">{selected.profile.cnicName}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Father Name</p>
                    <p className="mt-1 font-semibold text-slate-900">{selected.profile.fatherName}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">CNIC Validity</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {selected.profile.cnicIssueDate} – {selected.profile.cnicExpiryDate}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Bank / Wallet</p>
                    <p className="mt-1 font-semibold text-slate-900">{selected.profile.bankWalletName}</p>
                  </div>
                  {selected.profile.accountNumber && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Account</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {selected.profile.accountTitle} — {selected.profile.accountNumber}
                      </p>
                      <p className="text-xs text-slate-500">
                        {selected.profile.branchName} ({selected.profile.branchCode})
                      </p>
                    </div>
                  )}
                  {selected.profile.registeredMobileNumber && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Registered Mobile</p>
                      <p className="mt-1 font-semibold text-slate-900">{selected.profile.registeredMobileNumber}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Warehouse</p>
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    <p><span className="font-medium">Address:</span> {selected.profile.warehouseAddress}</p>
                    <p><span className="font-medium">Location:</span> {selected.profile.warehouseLocation}</p>
                    <p className="mt-1">{selected.profile.warehouseInfo}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-5">
              <button
                onClick={() => { setRejectTarget(selected.vendorId); setRejectReason(""); }}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Reject
              </button>
              <button
                onClick={() => void handleApprove(selected.vendorId)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Approve vendor
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} label="Reject vendor profile" size="max-w-md">
        {rejectTarget && (
          <div className="rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Reject Vendor Profile</h3>
            <p className="mt-1 text-sm text-gray-500">Provide a reason so the vendor knows what to fix.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. CNIC image unclear, bank details incomplete."
              rows={3}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRejectTarget(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
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
        )}
      </Modal>
    </div>
  );
};

export default AdminVendorApprovalsQueue;
