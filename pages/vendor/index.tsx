import DashboardLayout from "../../layouts/DashboardLayout";
import DashboardHome from "../../views/dashboard/DashboardHome";

export default function VendorDashboardPage() {
  return (
    <DashboardLayout requiredRoles={["vendor"]}>
      <DashboardHome />
    </DashboardLayout>
  );
}
