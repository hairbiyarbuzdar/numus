import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import CartDrawer from "../components/CartDrawer";
import CartToast from "../components/CartToast";
import { Role } from "../types";
import { useAuth } from "../context/AuthContext";

interface DashboardLayoutProps {
  children: React.ReactNode;
  requiredRoles?: Role[];
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, requiredRoles }) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const handleCloseSidebar = useCallback(() => setSidebarOpen(false), []);
  const handleToggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (loading || !mounted) return;

    if (!user) {
      void router.replace("/login");
      return;
    }

    if (requiredRoles && !requiredRoles.includes(user.role)) {
      const fallbackPath = user.role === "superAdmin" ? "/admin" : `/${user.role}`;
      void router.replace(fallbackPath);
    }
  }, [loading, mounted, requiredRoles, router, user]);

  if (loading || !mounted) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) return null;
  if (requiredRoles && !requiredRoles.includes(user.role)) return null;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar toggleSidebar={handleToggleSidebar} />
        <CartToast />
        <CartDrawer />
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
