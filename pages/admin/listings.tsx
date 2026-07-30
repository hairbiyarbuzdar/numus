import { useEffect } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import AdminModulePage from "../../views/admin/AdminModulePage";
import { getListings } from "../../views/admin/adminData";
import { useProducts } from "../../context/ProductContext";

export default function AdminListingsPage() {
  const { products, loaded, ensureProducts } = useProducts();

  // Fetched when this page opens, not at login.
  useEffect(() => {
    void ensureProducts();
  }, [ensureProducts]);

  const listings = getListings(products);

  return (
    <DashboardLayout requiredRoles={["superAdmin"]}>
      <AdminModulePage
        title="Approved Product Listings"
        subtitle="Auto-sync farmer auctions, product listings, and MOQ wholesale entries."
        columns={["Listing", "Farmer", "Type", "Category", "MOQ", "Status"]}
        loading={!loaded}
        rows={listings.map((listing) => [
          listing.title,
          listing.farmer,
          listing.type,
          listing.category,
          listing.moq,
          listing.status,
        ])}
      />
    </DashboardLayout>
  );
}
