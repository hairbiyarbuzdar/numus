import DashboardLayout from "../../layouts/DashboardLayout";
import VendorDashboard from "../../views/vendor/VendorDashboard";

export default function VendorDashboardPage() {
  return (
    <DashboardLayout requiredRoles={["vendor"]}>
      <VendorDashboard />
    </DashboardLayout>
  );
}
