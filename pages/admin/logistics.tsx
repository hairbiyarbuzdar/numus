import DashboardLayout from "../../layouts/DashboardLayout";
import LogisticsManager from "../../views/admin/LogisticsManager";

export default function AdminLogisticsPage() {
  return (
    <DashboardLayout requiredRoles={["superAdmin"]}>
      <LogisticsManager />
    </DashboardLayout>
  );
}
