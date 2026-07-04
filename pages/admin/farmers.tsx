import DashboardLayout from "../../layouts/DashboardLayout";
import AdminUsersManager from "../../views/admin/AdminUsersManager";

export default function AdminFarmersPage() {
  return (
    <DashboardLayout requiredRoles={["superAdmin"]}>
      <AdminUsersManager defaultType="farmer" />
    </DashboardLayout>
  );
}
