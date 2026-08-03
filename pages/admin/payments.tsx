import DashboardLayout from "../../layouts/DashboardLayout";
import AdminPayments from "../../views/admin/AdminPayments";

export default function AdminPaymentsPage() {
  return (
    <DashboardLayout requiredRoles={["superAdmin"]}>
      <AdminPayments />
    </DashboardLayout>
  );
}
