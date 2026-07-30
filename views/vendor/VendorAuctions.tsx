import React, { useEffect, useRef, useState } from 'react';
import { Plus, Eye, Trash2, Trophy, Edit2, Lock, Loader2, X } from 'lucide-react';
import { formatCurrency, formatDateTime, getTimeRemaining, getAuctionEditLock } from '../../utils/helpers';
import { useProducts } from '../../context/ProductContext';
import { useAuth } from '../../context/AuthContext';
import { Product } from '../../types';
import { SkeletonCards } from '../../components/Skeleton';

// Matches the field-label style used elsewhere in the vendor portal
// (see views/vendor/VendorProducts.tsx).
const LABEL_CLASS = 'mb-1 block text-sm font-medium text-gray-700';
const INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded-lg';

const EMPTY_FORM = {
  title: '',
  description: '',
  category: '',
  startingPrice: '',
  bidIncrement: '',
  buyNowPrice: '',
  auctionQuantity: '1',
  startDate: '',
  endDate: '',
  durationDays: '3',
  image: '',
};

/** Timestamp → the `YYYY-MM-DDTHH:mm` local-time format a datetime-local input wants. */
const toDateTimeLocal = (timestamp?: number) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const VendorAuctions: React.FC = () => {
  const { products, loading, loaded, error, ensureProducts, refreshProducts, addAuction, updateAuction, deleteProduct, closeAuction } =
    useProducts();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  // Null while creating; the auction's id while editing an existing one.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const auctions = products.filter(p => p.isAuction && p.vendorId === user?.uid);
  const isEditing = editingId !== null;
  // Auctions are fetched when this page opens, not on login. Cached afterwards.
  const showSkeleton = !loaded && loading;

  useEffect(() => {
    void ensureProducts();
  }, [ensureProducts]);

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Image upload failed.'));
      reader.readAsDataURL(file);
    });

  const closeForm = () => {
    setForm(EMPTY_FORM);
    setImagePreview('');
    setEditingId(null);
    setShowForm(false);
  };

  const startCreate = () => {
    if (showForm && !isEditing) {
      closeForm();
      return;
    }
    setForm(EMPTY_FORM);
    setImagePreview('');
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (auction: Product) => {
    const lock = getAuctionEditLock(auction);
    if (!lock.editable) {
      alert(lock.reason);
      return;
    }

    setForm({
      title: auction.title || '',
      description: auction.description || '',
      category: auction.category || '',
      startingPrice: auction.startingPrice !== undefined ? String(auction.startingPrice) : '',
      bidIncrement: auction.bidIncrement !== undefined ? String(auction.bidIncrement) : '',
      buyNowPrice: auction.buyNowPrice !== undefined ? String(auction.buyNowPrice) : '',
      auctionQuantity: auction.auctionQuantity !== undefined ? String(auction.auctionQuantity) : '1',
      startDate: toDateTimeLocal(auction.auctionStartTime),
      endDate: toDateTimeLocal(auction.auctionEndTime),
      durationDays: '3',
      image: '',
    });
    setImagePreview(auction.images?.[0] || '');
    setEditingId(auction.id);
    setShowForm(true);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    // The ref (not the state flag) is what blocks a double submit: two clicks in
    // the same tick would both read a stale `isSaving === false`.
    if (savingRef.current) return;

    const imageToUse = imagePreview || form.image;
    if (!imageToUse) {
      alert('Please upload an image or provide an image URL.');
      return;
    }

    // Re-check the lock at submit time — the start time may have passed while
    // the form was open. The API enforces this too; this just saves a round trip.
    if (isEditing) {
      const auction = auctions.find((item) => item.id === editingId);
      const lock = auction ? getAuctionEditLock(auction) : { editable: false, reason: 'Auction not found.' };
      if (!lock.editable) {
        alert(lock.reason);
        closeForm();
        return;
      }
    }

    savingRef.current = true;
    setIsSaving(true);

    try {
      if (isEditing && editingId) {
        await updateAuction(editingId, {
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category.trim(),
          images: [imageToUse],
          startingPrice: Number(form.startingPrice),
          bidIncrement: Number(form.bidIncrement),
          auctionQuantity: Number(form.auctionQuantity),
          buyNowPrice: form.buyNowPrice ? Number(form.buyNowPrice) : null,
          auctionStartTime: new Date(form.startDate).getTime(),
          auctionEndTime: new Date(form.endDate).getTime(),
        });
        closeForm();
        alert('Auction updated successfully.');
        return;
      }

      await addAuction({
        vendorId: user.uid,
        vendorName: user.displayName || 'Farmer',
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        image: imageToUse,
        startingPrice: Number(form.startingPrice),
        bidIncrement: Number(form.bidIncrement),
        auctionQuantity: Number(form.auctionQuantity),
        auctionStartTime: form.startDate ? new Date(form.startDate).getTime() : undefined,
        auctionEndTime: form.endDate ? new Date(form.endDate).getTime() : undefined,
        buyNowPrice: form.buyNowPrice ? Number(form.buyNowPrice) : undefined,
        durationDays: Number(form.durationDays),
      });

      closeForm();
      alert('Auction submitted successfully. It is now waiting for admin approval.');
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'create'} auction.`);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">My Live Auctions</h1>
        <button
          onClick={startCreate}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Auction
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="md:col-span-2 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {isEditing ? 'Edit Auction' : 'Create Auction'}
              </h2>
              {isEditing && (
                <p className="text-sm text-gray-500">
                  Details can be changed until bidding opens. After that the auction becomes read-only.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="p-1 text-gray-400 hover:text-gray-600"
              aria-label="Close form"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div>
            <label htmlFor="auction-title" className={LABEL_CLASS}>
              Auction Title <span className="text-red-500">*</span>
            </label>
            <input
              id="auction-title"
              required
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Basmati Paddy - 40 maund lot"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="auction-category" className={LABEL_CLASS}>
              Category <span className="text-red-500">*</span>
            </label>
            <input
              id="auction-category"
              required
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              placeholder="e.g. Grains (Ajnaas)"
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="auction-description" className={LABEL_CLASS}>
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="auction-description"
              required
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Short description bidders will see on the listing"
              className={`${INPUT_CLASS} min-h-[90px]`}
            />
          </div>
          <div>
            <label htmlFor="auction-starting-price" className={LABEL_CLASS}>
              Starting Price (PKR) <span className="text-red-500">*</span>
            </label>
            <input
              id="auction-starting-price"
              required
              type="number"
              min={1}
              value={form.startingPrice}
              onChange={(e) => setForm((prev) => ({ ...prev, startingPrice: e.target.value }))}
              placeholder="e.g. 50000"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="auction-bid-increment" className={LABEL_CLASS}>
              Bid Increment (PKR) <span className="text-red-500">*</span>
            </label>
            <input
              id="auction-bid-increment"
              required
              type="number"
              min={1}
              value={form.bidIncrement}
              onChange={(e) => setForm((prev) => ({ ...prev, bidIncrement: e.target.value }))}
              placeholder="e.g. 500"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="auction-buy-now-price" className={LABEL_CLASS}>Buy Now Price (PKR)</label>
            <input
              id="auction-buy-now-price"
              type="number"
              min={1}
              value={form.buyNowPrice}
              onChange={(e) => setForm((prev) => ({ ...prev, buyNowPrice: e.target.value }))}
              placeholder="Optional — leave blank for none"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="auction-quantity" className={LABEL_CLASS}>
              Quantity <span className="text-red-500">*</span>
            </label>
            <input
              id="auction-quantity"
              required
              type="number"
              min={1}
              value={form.auctionQuantity}
              onChange={(e) => setForm((prev) => ({ ...prev, auctionQuantity: e.target.value }))}
              placeholder="e.g. 1"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="auction-start-date" className={LABEL_CLASS}>
              Bidding Starts {isEditing && <span className="text-red-500">*</span>}
            </label>
            <input
              id="auction-start-date"
              type="datetime-local"
              required={isEditing}
              value={form.startDate}
              onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
              className={INPUT_CLASS}
            />
            {!isEditing && (
              <p className="mt-1 text-xs text-gray-500">
                Leave blank to open bidding immediately. Details can only be edited before bidding opens.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="auction-end-date" className={LABEL_CLASS}>
              Bidding Ends {isEditing && <span className="text-red-500">*</span>}
            </label>
            <input
              id="auction-end-date"
              type="datetime-local"
              required={isEditing}
              value={form.endDate}
              onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
              className={INPUT_CLASS}
            />
          </div>
          {/* Duration only seeds the end time at creation — an existing auction
              already has explicit start/end times to edit. */}
          {!isEditing && (
            <div>
              <label htmlFor="auction-duration" className={LABEL_CLASS}>
                Duration (days) <span className="text-red-500">*</span>
              </label>
              <input
                id="auction-duration"
                required
                type="number"
                min={1}
                value={form.durationDays}
                onChange={(e) => setForm((prev) => ({ ...prev, durationDays: e.target.value }))}
                placeholder="e.g. 3"
                className={INPUT_CLASS}
              />
            </div>
          )}
          <div className="md:col-span-2">
            <label htmlFor="auction-image-url" className={LABEL_CLASS}>Image URL</label>
            <input
              id="auction-image-url"
              value={form.image}
              onChange={(e) => setForm((prev) => ({ ...prev, image: e.target.value }))}
              placeholder="Optional if you upload a file below"
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="auction-image-file" className={LABEL_CLASS}>Upload Image</label>
            <input
              id="auction-image-file"
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const dataUrl = await readFileAsDataUrl(file);
                setImagePreview(dataUrl);
              }}
              className={INPUT_CLASS}
            />
          </div>
          {imagePreview && (
            <img src={imagePreview} alt="Preview" className="w-24 h-24 object-cover rounded-lg border border-gray-200" />
          )}
          <div className="md:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Save Auction'}
            </button>
          </div>
        </form>
      )}

      {error && !showSkeleton && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button onClick={() => void refreshProducts()} className="ml-2 font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {showSkeleton && <SkeletonCards count={2} label="Loading your auctions" />}

      {!showSkeleton && loaded && auctions.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <p className="font-medium text-gray-700">You haven&apos;t created any auctions yet.</p>
          <p className="mt-1 text-sm text-gray-500">Use Create Auction to list your first lot.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {!showSkeleton && auctions.map(auction => {
            const timeLeft = auction.auctionEndTime ? getTimeRemaining(auction.auctionEndTime) : null;
            const editLock = getAuctionEditLock(auction);
            return (
                <div key={auction.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-4">
                            <img src={auction.images[0]} alt={auction.title} className="w-16 h-16 rounded-lg object-cover" />
                            <div>
                                <h3 className="font-bold text-gray-900">{auction.title}</h3>
                                <p className="text-sm text-gray-500">Ref: #{auction.id}</p>
                            </div>
                        </div>
                        <span className={`${auction.auctionStatus === 'ended' ? 'bg-slate-100 text-slate-700' : 'bg-green-100 text-green-700'} text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1`}>
                            <span className={`w-2 h-2 rounded-full ${auction.auctionStatus === 'ended' ? 'bg-slate-500' : 'bg-green-500 animate-pulse'}`}></span>
                            {auction.auctionStatus === 'ended' ? 'ENDED' : 'ACTIVE'}
                        </span>
                    </div>

                    {editLock.editable ? (
                      <p className="mb-4 flex items-center gap-1.5 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                        <Edit2 className="w-4 h-4 shrink-0" />
                        Bidding opens {formatDateTime(auction.auctionStartTime)} — you can still edit the details until then.
                      </p>
                    ) : (
                      <p className="mb-4 flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                        <Lock className="w-4 h-4 shrink-0" />
                        {editLock.reason}
                      </p>
                    )}

                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-gray-50 p-3 rounded-lg text-center">
                            <p className="text-xs text-gray-500 uppercase font-semibold">Current Bid</p>
                            <p className="text-lg font-bold text-purple-700">{formatCurrency(auction.currentHighestBid || 0)}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg text-center">
                            <p className="text-xs text-gray-500 uppercase font-semibold">Bids</p>
                            <p className="text-lg font-bold text-gray-900">{auction.bids?.length || 0}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg text-center">
                            <p className="text-xs text-gray-500 uppercase font-semibold">Time Left</p>
                            <p className="text-sm font-bold text-gray-900 mt-1">
                                {timeLeft ? `${timeLeft.days}d ${timeLeft.hours}h` : 'Ended'}
                            </p>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                        <p className="text-sm font-bold text-gray-900 mb-2">Recent Activity</p>
                        <div className="space-y-2 mb-4">
                             {(auction.bids || []).map(bid => (
                                 <div key={bid.id} className="flex justify-between text-sm text-gray-600">
                                     <span>{bid.bidderName} placed a bid</span>
                                     <span className="font-mono">{formatCurrency(bid.amount)}</span>
                                 </div>
                             ))}
                             {auction.winnerBidderName && (
                              <div className="text-sm text-emerald-700 flex items-center gap-1.5 pt-2">
                                <Trophy className="w-4 h-4" />
                                Highest bidder: {auction.winnerBidderName}
                              </div>
                             )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button className="w-full py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                                <Eye className="w-4 h-4" /> View Details
                            </button>
                            {/* Left clickable when locked so the reason can be shown. */}
                            <button
                              onClick={() => startEdit(auction)}
                              aria-disabled={!editLock.editable}
                              title={editLock.editable ? 'Edit auction details' : editLock.reason}
                              className={`w-full py-2 border rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                editLock.editable
                                  ? 'border-purple-300 text-purple-700 hover:bg-purple-50'
                                  : 'border-gray-200 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              {editLock.editable ? <Edit2 className="w-4 h-4" /> : <Lock className="w-4 h-4" />} Edit
                            </button>
                            {auction.auctionStatus !== 'ended' && (
                              <button
                                onClick={async () => {
                                  const result = await closeAuction(auction.id);
                                  if (!result.ok) {
                                    alert("Unable to close auction.");
                                    return;
                                  }
                                  alert(result.winnerBidderName ? `Auction closed. Winner: ${result.winnerBidderName}` : "Auction closed with no bids.");
                                }}
                                className="w-full py-2 border border-amber-300 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-50 transition-colors"
                              >
                                Close Now
                              </button>
                            )}
                            <button
                              onClick={() => {
                                const confirmed = window.confirm(`Delete "${auction.title}" auction?`);
                                if (!confirmed) return;
                                if (editingId === auction.id) closeForm();
                                void deleteProduct(auction.id).catch((err) => {
                                  alert(err instanceof Error ? err.message : "Failed to delete auction.");
                                });
                              }}
                              className="w-full py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            )
        })}
      </div>
    </div>
  );
};

export default VendorAuctions;
