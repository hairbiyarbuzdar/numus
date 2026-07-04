import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Search, Filter } from 'lucide-react';
import { Product } from '../../types';
import { formatCurrency } from '../../utils/helpers';
import { useProducts } from '../../context/ProductContext';
import { useAuth } from '../../context/AuthContext';

const VendorProducts: React.FC = () => {
  const { products, addProduct, deleteProduct } = useProducts();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [imagePreview, setImagePreview] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    productType: 'retail' as 'retail' | 'wholesale',
    basePrice: '',
    stock: '',
    minOrderQty: '1',
    image: '',
  });

  const vendorProducts: Product[] = products.filter((p) => p.vendorId === user?.uid);

  const getModerationBadge = (product: Product) => {
    if (product.approvalStatus === 'approved') {
      return { label: 'Approved', className: 'bg-emerald-100 text-emerald-700' };
    }
    if (product.approvalStatus === 'rejected') {
      return { label: 'Rejected', className: 'bg-red-100 text-red-700' };
    }
    return { label: 'Pending Approval', className: 'bg-amber-100 text-amber-700' };
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Image upload failed.'));
      reader.readAsDataURL(file);
    });

  const handleCreateProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const imageToUse = imagePreview || form.image;
    if (!imageToUse) {
      alert('Please upload an image or provide an image URL.');
      return;
    }

    try {
      await addProduct({
        vendorId: user.uid,
        vendorName: user.displayName || 'Farmer',
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        image: imageToUse,
        productType: form.productType,
        basePrice: Number(form.basePrice),
        stock: Number(form.stock),
        minOrderQty: Number(form.minOrderQty),
      });

      setForm({
        title: '',
        description: '',
        category: '',
        productType: 'retail',
        basePrice: '',
        stock: '',
        minOrderQty: '1',
        image: '',
      });
      setImagePreview('');
      setShowForm(false);
      alert('Product submitted successfully. It is now waiting for admin approval.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit product.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">My Products</h1>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <input
            required
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Product title"
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
          <select
            value={form.productType}
            onChange={(e) => setForm((prev) => ({ ...prev, productType: e.target.value as 'retail' | 'wholesale' }))}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale (MOQ)</option>
          </select>
          <input
            required
            type="number"
            min={1}
            value={form.basePrice}
            onChange={(e) => setForm((prev) => ({ ...prev, basePrice: e.target.value }))}
            placeholder="Base price"
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            required
            type="number"
            min={1}
            value={form.stock}
            onChange={(e) => setForm((prev) => ({ ...prev, stock: e.target.value }))}
            placeholder="Stock"
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            required
            type="number"
            min={1}
            value={form.minOrderQty}
            onChange={(e) => setForm((prev) => ({ ...prev, minOrderQty: e.target.value }))}
            placeholder="MOQ / Min order qty"
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
            <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
              Save Product
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search your inventory..." 
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-gray-300 rounded-lg flex items-center gap-2 hover:bg-gray-50">
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </button>
          <select className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option>All Status</option>
            <option>Active</option>
            <option>Draft</option>
            <option>Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Price/Bid</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {vendorProducts.map((product) => {
                const moderationBadge = getModerationBadge(product);
                return (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <img 
                        src={product.images[0]} 
                        alt={product.title} 
                        className="w-12 h-12 rounded-lg object-cover border border-gray-200" 
                      />
                      <div>
                        <p className="font-medium text-gray-900">{product.title}</p>
                        <p className="text-sm text-gray-500">{product.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`
                      px-2 py-1 text-xs font-semibold rounded-full
                      ${product.productType === 'auction' ? 'bg-purple-100 text-purple-700' : 
                        product.productType === 'wholesale' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}
                    `}>
                      {product.productType.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {product.isAuction 
                      ? `${formatCurrency(product.currentHighestBid || product.startingPrice || 0)} (Current Bid)`
                      : formatCurrency(product.basePrice || 0)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {product.stock} units
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-semibold ${moderationBadge.className}`}>
                        {moderationBadge.label}
                      </span>
                      {product.approvalStatus === 'rejected' && product.rejectionReason && (
                        <p className="max-w-[220px] text-xs text-red-500">{product.rejectionReason}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          const confirmed = window.confirm(`Delete "${product.title}"?`);
                          if (!confirmed) return;
                          void deleteProduct(product.id).catch((err) => {
                            alert(err instanceof Error ? err.message : 'Failed to delete product.');
                          });
                        }}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default VendorProducts;
