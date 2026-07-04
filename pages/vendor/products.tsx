import DashboardLayout from "../../layouts/DashboardLayout";
import VendorProducts from "../../views/vendor/VendorProducts";

export default function VendorProductsPage() {
  return (
    <DashboardLayout requiredRoles={["vendor"]}>
      <VendorProducts />
    </DashboardLayout>
  );
}
