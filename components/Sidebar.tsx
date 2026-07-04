import React from 'react';
import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Settings,
  BarChart,
  Gavel,
  Truck,
  Heart,
  CircleCheckBig,
  CreditCard,
  Store,
  Clock,
  TrendingUp,
  Bell,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const router = useRouter();
  const { pathname } = router;
  
  const getLinks = () => {
    switch(user?.role) {
      case 'superAdmin':
        return [
          { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
          { name: 'Approvals', path: '/admin/approvals', icon: Clock },
          { name: 'Products', path: '/admin/products', icon: Package },
          { name: 'Auctions', path: '/admin/auctions', icon: Gavel },
          { name: 'Orders', path: '/admin/orders', icon: ShoppingBag },
          { name: 'Manage Farmers', path: '/admin/farmers', icon: Store },
          { name: 'Manage Customers', path: '/admin/customers', icon: Users },
          { name: 'Approved Listings', path: '/admin/listings', icon: CircleCheckBig },
          { name: 'Payments', path: '/admin/payments', icon: CreditCard },
          { name: 'Insights', path: '/admin/insights', icon: TrendingUp },
          { name: 'Notifications', path: '/admin/notifications', icon: Bell },
          { name: 'Logistics', path: '/admin/logistics', icon: Truck },
          { name: 'Settings', path: '/admin/settings', icon: Settings },
        ];
      case 'vendor':
        return [
          { name: 'Dashboard', path: '/vendor', icon: LayoutDashboard },
          { name: 'My Products', path: '/vendor/products', icon: Package },
          { name: 'Orders', path: '/vendor/orders', icon: ShoppingBag },
          { name: 'Auctions', path: '/vendor/auctions', icon: Gavel },
          { name: 'Finance', path: '/vendor/finance', icon: BarChart },
          { name: 'Settings', path: '/vendor/settings', icon: Settings },
        ];
      case 'buyer':
        return [
          { name: 'Marketplace', path: '/buyer', icon: ShoppingBag },
          { name: 'My Orders', path: '/buyer/orders', icon: Truck },
          { name: 'Auctions', path: '/buyer/auctions', icon: Gavel },
          { name: 'Wishlist', path: '/buyer/wishlist', icon: Heart },
          { name: 'Settings', path: '/buyer/settings', icon: Settings },
        ];
      default:
        return [];
    }
  };

  const links = getLinks();
  const isActiveLink = (path: string) => {
    const segments = path.split("/").filter(Boolean);
    const isRootPath = segments.length === 1;
    if (isRootPath) return pathname === path;
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 lg:hidden z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 bottom-0 bg-slate-900 text-white w-64 z-50 transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:block
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-center border-b border-slate-800 py-4">
          <div className="flex items-center justify-center rounded-full bg-white px-5 py-2.5">
            <img src="/numulogo.png" alt="Numu" className="h-12 w-auto object-contain" />
          </div>
        </div>

        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
          {links.map((link) => (
            <Link
              key={link.path}
              href={link.path}
              onClick={() => { if(window.innerWidth < 1024) onClose(); }}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                ${isActiveLink(link.path) 
                  ? 'bg-emerald-600 text-white' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
              `}
            >
              <link.icon className="w-5 h-5" />
              <span className="font-medium">{link.name}</span>
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
