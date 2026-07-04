import React, { useEffect, useState } from 'react';
import { useRouter } from "next/router";
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useOrders } from '../../context/OrdersContext';
import { formatCurrency } from '../../utils/helpers';
import { CITIES } from '../../constants';
import {
  Banknote,
  Building2,
  CreditCard,
  Loader2,
  Mail,
  Mailbox,
  MapPin,
  MessageCircle,
  Phone,
  ShoppingCart,
  Smartphone,
  User,
} from 'lucide-react';

type PaymentMethod = 'easypaisa' | 'jazzcash' | 'cod';

const Checkout: React.FC = () => {
  const { cart, cartTotal, clearCart } = useCart();
  const { user } = useAuth();
  const { createCheckoutOrder } = useOrders();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    fullName: user?.displayName || "",
    phoneNumber: "",
    whatsappNumber: "",
    email: user?.email || "",
    fullAddress: "",
    city: CITIES[0],
    postalCode: "",
    paymentMethod: "easypaisa" as PaymentMethod,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const deliveryFee = 500;
  const total = cartTotal + deliveryFee;

  useEffect(() => {
    if (cart.length === 0) {
      void router.replace('/buyer');
    }
  }, [cart.length, router]);

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) nextErrors.fullName = 'Full name is required.';
    if (!formData.phoneNumber.trim()) nextErrors.phoneNumber = 'Phone number is required.';
    if (!formData.whatsappNumber.trim()) nextErrors.whatsappNumber = 'WhatsApp number is required.';
    if (!formData.email.trim()) nextErrors.email = 'Email is required.';
    if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) nextErrors.email = 'Enter a valid email address.';
    if (!formData.fullAddress.trim()) nextErrors.fullAddress = 'Address is required.';
    if (!formData.city.trim()) nextErrors.city = 'City is required.';
    if (!formData.postalCode.trim()) nextErrors.postalCode = 'Postal code is required.';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);

    const orderData = {
      customerId: user?.uid || 'guest',
      customerInfo: {
        fullName: formData.fullName.trim(),
        phone: formData.phoneNumber.trim(),
        whatsapp: formData.whatsappNumber.trim(),
        email: formData.email.trim(),
      },
      addressInfo: {
        fullAddress: formData.fullAddress.trim(),
        city: formData.city,
        postalCode: formData.postalCode.trim(),
      },
      items: cart.map(item => ({
        productId: item.productId,
        title: item.title,
        price: item.price,
        qty: item.qty,
        image: item.image,
        vendorId: item.vendorId,
        vendorName: item.vendorName
      })),
      paymentMethod: formData.paymentMethod,
      subtotal: cartTotal,
      deliveryFee,
      total,
    };

    try {
      const newOrderId = createCheckoutOrder(orderData);
      clearCart();
      void router.push(`/buyer/order-confirmation?orderId=${encodeURIComponent(newOrderId)}`);
    } catch (error) {
      alert('Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-0">
      <section className="rounded-2xl border border-cyan-100 bg-gradient-to-r from-slate-900 via-cyan-900 to-teal-800 p-6 text-white shadow-lg mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingCart className="w-6 h-6" />
          Secure Checkout
        </h1>
        <p className="text-sm text-cyan-100 mt-2">Complete your details and place your order securely.</p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <form id="checkout-form" onSubmit={handleSubmit}>
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600" /> Personal Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input
                      required
                      type="text"
                      value={formData.fullName}
                      onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  {errors.fullName && <p className="text-xs text-red-600 mt-1">{errors.fullName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input
                      required
                      type="tel"
                      placeholder="+92 300 1234567"
                      value={formData.phoneNumber}
                      onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  {errors.phoneNumber && <p className="text-xs text-red-600 mt-1">{errors.phoneNumber}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
                  <div className="relative">
                    <MessageCircle className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input
                      required
                      type="tel"
                      placeholder="+92 300 1234567"
                      value={formData.whatsappNumber}
                      onChange={e => setFormData({ ...formData, whatsappNumber: e.target.value })}
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  {errors.whatsappNumber && <p className="text-xs text-red-600 mt-1">{errors.whatsappNumber}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input
                      required
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" /> Address Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Address</label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <textarea
                      required
                      rows={2}
                      value={formData.fullAddress}
                      onChange={e => setFormData({ ...formData, fullAddress: e.target.value })}
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  {errors.fullAddress && <p className="text-xs text-red-600 mt-1">{errors.fullAddress}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <select
                      value={formData.city}
                      onChange={e => setFormData({ ...formData, city: e.target.value })}
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    >
                      {CITIES.map(city => <option key={city} value={city}>{city}</option>)}
                    </select>
                  </div>
                  {errors.city && <p className="text-xs text-red-600 mt-1">{errors.city}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                  <div className="relative">
                    <Mailbox className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input
                      required
                      type="text"
                      value={formData.postalCode}
                      onChange={e => setFormData({ ...formData, postalCode: e.target.value })}
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  {errors.postalCode && <p className="text-xs text-red-600 mt-1">{errors.postalCode}</p>}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" /> Payment Method Selection
              </h2>
              <div className="space-y-3">
                <label className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all ${formData.paymentMethod === 'easypaisa' ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'border-gray-200 hover:border-emerald-300'}`}>
                  <input 
                    type="radio"
                    name="payment"
                    value="easypaisa"
                    checked={formData.paymentMethod === 'easypaisa'}
                    onChange={() => setFormData({ ...formData, paymentMethod: 'easypaisa' })}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <Smartphone className="w-4 h-4 ml-3 text-emerald-600" />
                  <span className="ml-2 font-medium text-gray-900">Easypaisa</span>
                </label>

                <label className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all ${formData.paymentMethod === 'jazzcash' ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'border-gray-200 hover:border-emerald-300'}`}>
                  <input
                    type="radio"
                    name="payment"
                    value="jazzcash"
                    checked={formData.paymentMethod === 'jazzcash'}
                    onChange={() => setFormData({ ...formData, paymentMethod: 'jazzcash' })}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <Smartphone className="w-4 h-4 ml-3 text-cyan-700" />
                  <span className="ml-2 font-medium text-gray-900">JazzCash</span>
                </label>

                <label className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all ${formData.paymentMethod === 'cod' ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'border-gray-200 hover:border-emerald-300'}`}>
                  <input
                    type="radio"
                    name="payment"
                    value="cod"
                    checked={formData.paymentMethod === 'cod'}
                    onChange={() => setFormData({ ...formData, paymentMethod: 'cod' })}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <Banknote className="w-4 h-4 ml-3 text-amber-600" />
                  <span className="ml-2 font-medium text-gray-900">Cash on Delivery</span>
                </label>
              </div>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm sticky top-24">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h3>
            
            <div className="space-y-4 mb-6 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {cart.map(item => (
                <div key={item.productId} className="flex justify-between text-sm">
                  <div className="flex gap-2">
                    <span className="text-gray-500">{item.qty}x</span>
                    <span className="text-gray-900 truncate max-w-[150px]">{item.title}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(item.price * item.qty)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatCurrency(cartTotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Delivery Fee</span>
                <span>{formatCurrency(deliveryFee)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg text-gray-900 pt-2 border-t border-gray-100">
                <span>Total Amount</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <button 
              type="submit"
              form="checkout-form"
              disabled={loading}
              className="w-full mt-6 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
              {loading ? 'Processing...' : 'Place Order'}
            </button>
            <p className="text-xs text-center text-gray-500 mt-3">
              By placing an order you agree to our terms of service.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Checkout;
