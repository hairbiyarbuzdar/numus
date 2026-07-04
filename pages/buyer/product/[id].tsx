import DashboardLayout from "../../../layouts/DashboardLayout";
import ProductDetails from "../../../views/marketplace/ProductDetails";

export default function BuyerProductDetailsPage() {
  return (
    <DashboardLayout requiredRoles={["buyer"]}>
      <ProductDetails />
    </DashboardLayout>
  );
}
