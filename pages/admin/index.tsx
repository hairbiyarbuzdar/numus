import DashboardLayout from "../../layouts/DashboardLayout";
import SuperAdminDashboard from "../../views/admin/SuperAdminDashboard";

export default function AdminDashboardPage() {
  return (
    <DashboardLayout requiredRoles={["superAdmin"]}>
      <SuperAdminDashboard />
    </DashboardLayout>
  );
}
