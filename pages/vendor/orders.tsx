import DashboardLayout from "../../layouts/DashboardLayout";
import VendorOrders from "../../views/orders/VendorOrders";

export default function VendorOrdersPage() {
  return (
    <DashboardLayout requiredRoles={["vendor"]}>
      <VendorOrders />
    </DashboardLayout>
  );
}
