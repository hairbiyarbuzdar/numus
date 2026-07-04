import DashboardLayout from "../../layouts/DashboardLayout";
import AdminProductsManager from "../../views/admin/AdminProductsManager";

export default function AdminProductsPage() {
  return (
    <DashboardLayout requiredRoles={["superAdmin"]}>
      <AdminProductsManager />
    </DashboardLayout>
  );
}
