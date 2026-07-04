import DashboardLayout from "../../layouts/DashboardLayout";
import AdminNotificationsCenter from "../../views/admin/AdminNotificationsCenter";

export default function AdminNotificationsPage() {
  return (
    <DashboardLayout requiredRoles={["superAdmin"]}>
      <AdminNotificationsCenter />
    </DashboardLayout>
  );
}
