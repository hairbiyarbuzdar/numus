import DashboardLayout from "../../layouts/DashboardLayout";
import AdminAuctionsManager from "../../views/admin/AdminAuctionsManager";

export default function AdminAuctionsPage() {
  return (
    <DashboardLayout requiredRoles={["superAdmin"]}>
      <AdminAuctionsManager />
    </DashboardLayout>
  );
}
