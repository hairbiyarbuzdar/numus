import DashboardLayout from "../../layouts/DashboardLayout";
import AdminUsersManager from "../../views/admin/AdminUsersManager";

export default function AdminCustomersPage() {
  return (
    <DashboardLayout requiredRoles={["superAdmin"]}>
      <AdminUsersManager defaultType="customer" />
    </DashboardLayout>
  );
}
