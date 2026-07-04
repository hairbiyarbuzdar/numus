import DashboardLayout from "../../layouts/DashboardLayout";
import Wishlist from "../../views/marketplace/Wishlist";

export default function BuyerWishlistPage() {
  return (
    <DashboardLayout requiredRoles={["buyer"]}>
      <Wishlist />
    </DashboardLayout>
  );
}
