import DashboardLayout from "../../layouts/DashboardLayout";
import AdminOrders from "../../views/orders/AdminOrders";

export default function AdminOrdersPage() {
  return (
    <DashboardLayout requiredRoles={["superAdmin"]}>
      <AdminOrders />
    </DashboardLayout>
  );
}
