import React, { useEffect, useRef, useState } from 'react';
import { Bell, Search, Menu, LogOut, User as UserIcon, ShoppingCart, CheckCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useNotifications } from '../context/NotificationsContext';
import { APP_NAME } from '../constants';
import Link from "next/link";
import { useRouter } from "next/router";

interface NavbarProps {
  toggleSidebar: () => void;
}

const timeAgo = (ts: number) => {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
};

const Navbar: React.FC<NavbarProps> = ({ toggleSidebar }) => {
  const { user, logout } = useAuth();
  const { cartCount, openCart } = useCart();
  const { wishlistCount } = useWishlist();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const router = useRouter();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const bellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setBellOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
        setBellOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    await logout();
    void router.push("/login");
  };

  const recentNotifications = notifications.slice(0, 8);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="lg:hidden font-bold text-xl text-emerald-700">{APP_NAME}</div>

        <div className="hidden md:flex items-center relative w-96">
          <Search className="absolute left-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search products, orders, or vendors..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {user?.role === 'buyer' && (
          <>
            <Link href="/buyer/wishlist" className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
              </svg>
              {wishlistCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-pink-600 text-white text-[10px] font-bold flex items-center justify-center rounded-full border border-white">
                  {wishlistCount}
                </span>
              )}
            </Link>
            <button
              onClick={openCart}
              className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Open cart"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center rounded-full border border-white">
                  {cartCount}
                </span>
              )}
            </button>
          </>
        )}

        {/* Bell + Dropdown */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => setBellOpen((prev) => !prev)}
            className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white border border-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-gray-600" />
                  <span className="font-semibold text-gray-800 text-sm">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={() => { void markAllRead(); }}
                    className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {recentNotifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No notifications yet</p>
                  </div>
                ) : (
                  recentNotifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => { void markRead(n.id); }}
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${
                        n.read ? "opacity-60" : "bg-emerald-50/40"
                      }`}
                    >
                      <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-gray-300" : "bg-emerald-500"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="border-t border-gray-100 px-4 py-2.5">
                  <Link
                    href={user?.role === "superAdmin" ? "/admin/notifications" : user?.role === "vendor" ? "/vendor/orders" : "/buyer/orders"}
                    onClick={() => setBellOpen(false)}
                    className="block text-center text-xs font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    View all notifications →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold text-gray-800">{user?.displayName}</p>
            <p className="text-xs text-emerald-600 capitalize">{user?.role}</p>
          </div>
          <div className="relative" ref={profileMenuRef}>
            <button
              className="flex items-center gap-2"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
            >
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 border-2 border-emerald-200 overflow-hidden">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <UserIcon className="w-5 h-5" />
                )}
              </div>
            </button>

            <div className={`absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 ${profileMenuOpen ? "block" : "hidden"}`}>
              <Link href="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Profile Settings</Link>
              <button
                onClick={() => { void handleLogout(); }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default React.memo(Navbar);
