import DashboardLayout from "../../layouts/DashboardLayout";
import AdminInsights from "../../views/admin/AdminInsights";

export default function AdminInsightsPage() {
  return (
    <DashboardLayout requiredRoles={["superAdmin"]}>
      <AdminInsights />
    </DashboardLayout>
  );
}
