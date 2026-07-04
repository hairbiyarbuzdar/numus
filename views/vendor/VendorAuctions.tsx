import React, { useState } from 'react';
import { Plus, Eye, Trash2, Trophy } from 'lucide-react';
import { formatCurrency, getTimeRemaining } from '../../utils/helpers';
import { useProducts } from '../../context/ProductContext';
import { useAuth } from '../../context/AuthContext';

const VendorAuctions: React.FC = () => {
  const { products, addAuction, deleteProduct, closeAuction } = useProducts();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [imagePreview, setImagePreview] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    startingPrice: '',
    bidIncrement: '',
    buyNowPrice: '',
    auctionQuantity: '1',
    startDate: '',
    endDate: '',
    durationDays: null,
    image: '',
  });
  const auctions = products.filter(p => p.isAuction && p.vendorId === user?.uid);

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Image upload failed.'));
      reader.readAsDataURL(file);
    });

  const handleCreateAuction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const imageToUse = imagePreview || form.image;
    if (!imageToUse) {
      alert('Please upload an image or provide an image URL.');
      return;
    }

    try {
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

      setForm({
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
      });
      setImagePreview('');
      setShowForm(false);
      alert('Auction submitted successfully. It is now waiting for admin approval.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create auction.');
    }
  };

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">My Live Auctions</h1>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Auction
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateAuction} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <input
            required
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Auction title"
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            required
            value={form.category}
            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            placeholder="Category"
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <textarea
            required
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Short description"
            className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg min-h-[90px]"
          />
          <input
            required
            type="number"
            min={1}
            value={form.startingPrice}
            onChange={(e) => setForm((prev) => ({ ...prev, startingPrice: e.target.value }))}
            placeholder="Starting price"
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            required
            type="number"
            min={1}
            value={form.bidIncrement}
            onChange={(e) => setForm((prev) => ({ ...prev, bidIncrement: e.target.value }))}
            placeholder="Bid increment"
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            type="number"
            min={1}
            value={form.buyNowPrice}
            onChange={(e) => setForm((prev) => ({ ...prev, buyNowPrice: e.target.value }))}
            placeholder="Buy now price (optional)"
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            required
            type="number"
            min={1}
            value={form.auctionQuantity}
            onChange={(e) => setForm((prev) => ({ ...prev, auctionQuantity: e.target.value }))}
            placeholder="Quantity"
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            type="datetime-local"
            value={form.startDate}
            onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            type="datetime-local"
            value={form.endDate}
            onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            required
            type="number"
            min={1}
            value={form.durationDays}
            onChange={(e) => setForm((prev) => ({ ...prev, durationDays: e.target.value }))}
            placeholder="Duration days"
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            value={form.image}
            onChange={(e) => setForm((prev) => ({ ...prev, image: e.target.value }))}
            placeholder="Image URL (optional if uploading)"
            className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const dataUrl = await readFileAsDataUrl(file);
              setImagePreview(dataUrl);
            }}
            className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg"
          />
          {imagePreview && (
            <img src={imagePreview} alt="Preview" className="w-24 h-24 object-cover rounded-lg border border-gray-200" />
          )}
          <div className="md:col-span-2 flex justify-end">
            <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              Save Auction
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {auctions.map(auction => {
            const timeLeft = auction.auctionEndTime ? getTimeRemaining(auction.auctionEndTime) : null;
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
                        <div className="grid grid-cols-3 gap-2">
                            <button className="w-full py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                                <Eye className="w-4 h-4" /> View Details
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
