import React, { useMemo, useState } from 'react';
import Link from "next/link";
import { 
  Leaf, ShoppingCart, Search, Menu, Phone, 
  MapPin, ChevronRight, Star, Heart, 
  ShieldCheck, Truck, Headphones, User, X
} from 'lucide-react';
import { APP_NAME, MOCK_PRODUCTS, CATEGORIES } from '../constants';
import { formatCurrency } from '../utils/helpers';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const LandingPage: React.FC = () => {
  const { cartCount } = useCart();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const accountHref = user ? (user.role === "superAdmin" ? "/admin" : `/${user.role}`) : "/login";
  
  // Products
  const featured = useMemo(() => MOCK_PRODUCTS.slice(0, 8), []);

  const CategoryIcon = ({ name }: { name: string }) => {
    // Simple mock mapping for category images/icons
    const getIcon = () => {
      if (name.includes('Seeds')) return "🌱";
      if (name.includes('Fertilizers')) return "🧪";
      if (name.includes('Pesticides')) return "🛡️";
      if (name.includes('Machinery')) return "🚜";
      if (name.includes('Solar')) return "☀️";
      if (name.includes('Livestock')) return "🐄";
      if (name.includes('Fruits')) return "🥭";
      return "🌾";
    };

    return (
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-4xl mb-3 hover:bg-green-50 hover:border-green-300 transition-all shadow-sm mx-auto">
        {getIcon()}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white font-sans text-gray-800">
      
      {/* 1. TOP BAR (Dark Green) */}
      <div className="bg-green-900 text-white py-2 text-xs sm:text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> 0300-1234567</span>
            <span className="hidden sm:inline">|</span>
            <span className="hidden sm:inline">Welcome to Pakistan's No.1 Agri Marketplace</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="cursor-pointer hover:text-green-300">Urdu</span>
            <span>|</span>
            <Link href="/login" className="hover:text-green-300">Sell on {APP_NAME}</Link>
            <span>|</span>
            <Link href="/login" className="hover:text-green-300">Track Order</Link>
          </div>
        </div>
      </div>

      {/* 2. MAIN HEADER (Sticky) */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Logo & Mobile Menu */}
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden text-gray-600"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>

            <Link href="/" className="flex items-center gap-2">
              <div className="w-20 h-20 rounded-lg flex items-center justify-center text-white">
                <img src="/numulogo.png" alt="Logo" className="w-20 h-20 object-cover" loading="eager" decoding="async" />
              </div>

              {/* Text container */}
              <div className="flex flex-col leading-tight">
                {/* <span className="font-bold text-xl sm:text-2xl text-green-900 tracking-tight">
                  {APP_NAME}
                </span> */}
                <span className="text-[1rem] sm:text-[1.2rem] text-bold text-green-700">
                  Connect. Grow. Increase. Prosper.
                </span>
              </div>
            </Link>
          </div>


          {/* Search Bar (Centered) */}
          <div className="flex-1 max-w-2xl hidden md:block relative">
            <div className="flex">
              <input 
                type="text" 
                placeholder="Search for Seeds, Pesticides, Tractors..." 
                className="w-full pl-5 pr-4 py-2.5 bg-gray-50 border border-gray-200 border-r-0 rounded-l-lg focus:outline-none focus:ring-1 focus:ring-green-500"
              />
              <button className="bg-green-600 text-white px-6 py-2.5 rounded-r-lg hover:bg-green-700 font-medium flex items-center gap-2 transition-colors">
                <Search className="w-5 h-5" />
                Search
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-6">
            {user ? (
              <Link href={accountHref} className="flex flex-col items-center text-gray-600 hover:text-green-600 text-xs font-medium">
                <User className="w-6 h-6 mb-1" />
                <span className="hidden sm:block">Account</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="flex flex-col items-center text-gray-600 hover:text-green-600 text-xs font-medium"
              >
                <User className="w-6 h-6 mb-1" />
                <span className="hidden sm:block">Sign In</span>
              </Link>
            )}
            <Link href="/buyer/cart" className="flex flex-col items-center text-gray-600 hover:text-green-600 text-xs font-medium relative">
              <div className="relative">
                <ShoppingCart className="w-6 h-6 mb-1" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-2 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                    {cartCount}
                  </span>
                )}
              </div>
              <span className="hidden sm:block">Cart</span>
            </Link>
          </div>
        </div>

        {/* Mobile Search (Visible only on small screens) */}
        <div className="md:hidden px-4 pb-3">
          <div className="relative">
            <input 
                type="text" 
                placeholder="Search products..." 
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Secondary Nav (Categories) */}
        <div className="hidden lg:block border-t border-gray-100 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <ul className="flex items-center gap-8 text-sm font-medium text-gray-600 py-3 overflow-x-auto">
              <li className="text-green-600 font-bold flex items-center gap-1 cursor-pointer">
                <Menu className="w-4 h-4" /> All Categories
              </li>
              {CATEGORIES.slice(0, 6).map((cat, idx) => (
                <li key={idx} className="whitespace-nowrap hover:text-green-600 cursor-pointer transition-colors">
                  {cat}
                </li>
              ))}
              <li className="ml-auto text-red-500 font-bold cursor-pointer hover:text-red-600">Sale & Discounts</li>
            </ul>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)}></div>
          <div className="fixed top-0 left-0 bottom-0 w-64 bg-white shadow-xl z-50 overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center bg-green-900 text-white">
               <span className="font-bold text-lg">Menu</span>
               <button onClick={() => setMobileMenuOpen(false)}><X className="w-6 h-6" /></button>
            </div>
            <div className="p-4 space-y-4">
              {CATEGORIES.map((cat) => (
                <div key={cat} className="py-2 border-b border-gray-100 text-gray-700 font-medium">
                  {cat}
                </div>
              ))}
              <div className="pt-4 space-y-3">
                <Link href="/login?type=farmer" className="block w-full text-center py-2 bg-green-600 text-white rounded-lg">Farmer Sign In</Link>
                <Link href="/login?type=customer" className="block w-full text-center py-2 border border-green-600 text-green-600 rounded-lg">Customer Sign In</Link>
                <Link href="/login" className="block w-full text-center py-2 border border-green-600 text-green-600 rounded-lg">Sell on {APP_NAME}</Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. HERO SECTION */}
      <section className="bg-gray-100 py-4 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Main Banner */}
            <div className="md:col-span-8 lg:col-span-9 relative rounded-2xl overflow-hidden shadow-lg h-[300px] sm:h-[400px] bg-gray-900 group">
              <img 
                src="/download.jpg" 
                alt="Agriculture Banner" 
                className="w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-700"
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
              <div className="absolute inset-0 flex flex-col justify-center px-8 sm:px-12">
                <span className="bg-yellow-400 text-gray-900 text-xs font-bold px-3 py-1 rounded-full w-fit mb-4">Original Products</span>
                <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-4 leading-tight">
                  Maximize Your <br/> <span className="text-green-400">Crop Yield</span>
                </h2>
                <p className="text-gray-200 mb-8 max-w-md text-sm sm:text-base">
                  Get certified seeds, fertilizers, and pesticides delivered to your farm. 
                  Cash on delivery available across Pakistan.
                </p>
                <Link href="/login" className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold w-fit hover:bg-green-700 transition-colors flex items-center gap-2">
                  Shop Now <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
            </div>

            {/* Side Banners (Hidden on mobile) */}
            <div className="hidden md:flex md:col-span-4 lg:col-span-3 flex-col gap-6 h-[400px]">
               <div className="flex-1 bg-blue-600 rounded-2xl p-6 text-white relative overflow-hidden flex flex-col justify-center">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                  <h3 className="text-xl font-bold mb-2">Sell Your Crops</h3>
                  <p className="text-blue-100 text-sm mb-4">Directly to buyers without middleman.</p>
                  <Link href="/login" className="text-sm font-bold underline decoration-2 underline-offset-4 hover:text-blue-200">Register as Farmer</Link>
               </div>
               <div className="flex-1 bg-purple-700 rounded-2xl p-6 text-white relative overflow-hidden flex flex-col justify-center">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                  <h3 className="text-xl font-bold mb-2">Live Auctions</h3>
                  <p className="text-purple-100 text-sm mb-4">Bid on tractors and machinery.</p>
                  <Link href="/login" className="text-sm font-bold underline decoration-2 underline-offset-4 hover:text-purple-200">View Auctions</Link>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. VALUE PROPS (Icons) */}
      <section className="bg-white py-8 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="flex items-center gap-4 p-4 border rounded-xl bg-gray-50 hover:shadow-md transition-shadow">
                 <ShieldCheck className="w-10 h-10 text-green-600" />
                 <div>
                    <h4 className="font-bold text-gray-900">100% Original</h4>
                    <p className="text-xs text-gray-500">Certified Products</p>
                 </div>
              </div>
              <div className="flex items-center gap-4 p-4 border rounded-xl bg-gray-50 hover:shadow-md transition-shadow">
                 <Truck className="w-10 h-10 text-green-600" />
                 <div>
                    <h4 className="font-bold text-gray-900">Fast Delivery</h4>
                    <p className="text-xs text-gray-500">Across Pakistan</p>
                 </div>
              </div>
              <div className="flex items-center gap-4 p-4 border rounded-xl bg-gray-50 hover:shadow-md transition-shadow">
                 <MapPin className="w-10 h-10 text-green-600" />
                 <div>
                    <h4 className="font-bold text-gray-900">Track Order</h4>
                    <p className="text-xs text-gray-500">Real-time status</p>
                 </div>
              </div>
              <div className="flex items-center gap-4 p-4 border rounded-xl bg-gray-50 hover:shadow-md transition-shadow">
                 <Headphones className="w-10 h-10 text-green-600" />
                 <div>
                    <h4 className="font-bold text-gray-900">Expert Support</h4>
                    <p className="text-xs text-gray-500">Call 0300-1234567</p>
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* 5. SHOP BY CATEGORY */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center sm:text-left">Shop by Category</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-4 sm:gap-8">
             {CATEGORIES.map((cat, idx) => (
                <div key={idx} className="flex flex-col items-center group cursor-pointer">
                   <CategoryIcon name={cat} />
                   <span className="text-xs sm:text-sm font-semibold text-center group-hover:text-green-600">{cat}</span>
                </div>
             ))}
          </div>
        </div>
      </section>

      {/* 6. FEATURED PRODUCTS */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Best Selling Products</h2>
            <Link href="/login" className="text-green-600 font-bold text-sm hover:underline">View All</Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
             {featured.map((product) => (
                <div key={product.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden flex flex-col h-full">
                   <div className="relative h-48 bg-gray-100 overflow-hidden">
                      <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" decoding="async" />
                      {product.productType === 'wholesale' && (
                        <span className="absolute top-2 left-2 bg-yellow-400 text-xs font-bold px-2 py-1 rounded">Wholesale</span>
                      )}
                      {product.productType === 'auction' && (
                        <span className="absolute top-2 left-2 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded">Auction</span>
                      )}
                      <button className="absolute top-2 right-2 p-1.5 bg-white rounded-full text-gray-400 hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        <Heart className="w-4 h-4" />
                      </button>
                   </div>
                   <div className="p-4 flex flex-col flex-grow">
                      <div className="text-xs text-green-600 font-medium mb-1">{product.category}</div>
                      <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 text-sm sm:text-base group-hover:text-green-600 transition-colors">
                        {product.title}
                      </h3>
                      <div className="mt-auto">
                        <div className="flex items-center gap-1 mb-3">
                           <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                           <span className="text-xs text-gray-500">{product.rating} ({product.reviewsCount})</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-xs text-gray-400 line-through mr-2">
                               {formatCurrency((product.basePrice || product.startingPrice || 0) * 1.1)}
                            </span>
                            <span className="font-bold text-lg text-gray-900">
                               {formatCurrency(product.basePrice || product.currentHighestBid || 0)}
                            </span>
                          </div>
                          <Link href="/login" className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-colors">
                             <ShoppingCart className="w-5 h-5" />
                          </Link>
                        </div>
                      </div>
                   </div>
                </div>
             ))}
          </div>
        </div>
      </section>

      {/* 7. APP DOWNLOAD BANNER */}
      <section className="bg-green-900 py-16 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
           <div className="flex flex-col md:flex-row items-center justify-between gap-12">
              <div className="flex-1 text-center md:text-left">
                 <h2 className="text-3xl md:text-4xl font-bold mb-4">Download the {APP_NAME} App</h2>
                 <p className="text-green-100 text-lg mb-8 max-w-lg">
                   Buy inputs, sell crops, and manage your farm on the go. 
                   Available in Urdu, Punjabi, and English.
                 </p>
                 <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                    <button className="flex items-center gap-3 bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors border border-gray-700">
                       <div className="text-2xl"></div>
                       <div className="text-left">
                          <div className="text-[10px] uppercase">Download on the</div>
                          <div className="font-bold text-sm leading-none">App Store</div>
                       </div>
                    </button>
                    <button className="flex items-center gap-3 bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors border border-gray-700">
                       <div className="text-2xl">▶</div>
                       <div className="text-left">
                          <div className="text-[10px] uppercase">Get it on</div>
                          <div className="font-bold text-sm leading-none">Google Play</div>
                       </div>
                    </button>
                 </div>
              </div>
              <div className="flex-1 flex justify-center md:justify-end">
                 {/* Mock Phone Image */}
                 <div className="w-64 h-[400px] bg-white rounded-[2.5rem] border-8 border-gray-800 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-xl z-20"></div>
                    <img src="https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=400" alt="App Screen" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    <div className="absolute inset-0 bg-green-900/40 flex items-center justify-center">
                       <Leaf className="w-16 h-16 text-white" />
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* 8. FOOTER */}
      <footer className="bg-gray-50 pt-16 pb-8 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
              <div className="lg:col-span-2">
                 <Link href="/" className="flex items-center gap-2 mb-4">
                   <div className="w-20 h-20 rounded-lg flex items-center justify-center text-white">
                     <img src="/numulogo.png" alt="Logo" className="w-20 h-20 object-cover" loading="lazy" decoding="async" />
                   </div>
                   <span className="text-[1rem] sm:text-[1.2rem] text-bold text-green-700">
                      Connect. Grow. Increase. Prosper.
                    </span>
                 </Link>
                 <p className="text-gray-500 text-sm leading-relaxed mb-6 max-w-sm">
                   Pakistan's largest digital agriculture marketplace. We connect farmers directly with verified sellers for seeds, fertilizers, and machinery.
                 </p>
                 <div className="flex items-center gap-4 text-gray-400">
                    <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:border-green-500 hover:text-green-500 cursor-pointer">f</div>
                    <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:border-green-500 hover:text-green-500 cursor-pointer">in</div>
                    <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:border-green-500 hover:text-green-500 cursor-pointer">tw</div>
                 </div>
              </div>
              
              <div>
                 <h4 className="font-bold text-gray-900 mb-4">Quick Links</h4>
                 <ul className="space-y-2 text-sm text-gray-600">
                    <li><Link href="/login" className="hover:text-green-600">About Us</Link></li>
                    <li><Link href="/login" className="hover:text-green-600">Contact Us</Link></li>
                    <li><Link href="/login" className="hover:text-green-600">Sell on {APP_NAME}</Link></li>
                    <li><Link href="/login" className="hover:text-green-600">Affiliate Program</Link></li>
                 </ul>
              </div>

              <div>
                 <h4 className="font-bold text-gray-900 mb-4">Categories</h4>
                 <ul className="space-y-2 text-sm text-gray-600">
                    <li><Link href="/login" className="hover:text-green-600">Seeds & Fertilizers</Link></li>
                    <li><Link href="/login" className="hover:text-green-600">Tractors & Machinery</Link></li>
                    <li><Link href="/login" className="hover:text-green-600">Pesticides</Link></li>
                    <li><Link href="/login" className="hover:text-green-600">Solar Tubewells</Link></li>
                 </ul>
              </div>

              <div>
                 <h4 className="font-bold text-gray-900 mb-4">Contact</h4>
                 <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                       <MapPin className="w-4 h-4 mt-1 text-green-600" />
                       <span>Apartment 3, 4th floor, Plaza 109.110, Irenic Square, Block C, Gulberg Green</span>
                    </li>
                    <li className="flex items-center gap-2">
                       <Phone className="w-4 h-4 text-green-600" />
                       <span>0300-1234567</span>
                    </li>
                    <li className="flex items-center gap-2">
                       <div className="w-4 h-4 text-green-600">@</div>
                       <span>support@{APP_NAME.toLowerCase().replace(' ', '')}.pk</span>
                    </li>
                 </ul>
              </div>
           </div>
           
           <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
              <p>© 2024 {APP_NAME}. All rights reserved.</p>
              <div className="flex gap-4">
                 <span>Privacy Policy</span>
                 <span>Terms of Service</span>
                 <span>Refund Policy</span>
              </div>
           </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;

