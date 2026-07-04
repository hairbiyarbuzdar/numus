import DashboardLayout from "../../layouts/DashboardLayout";
import AdminApprovalsQueue from "../../views/admin/AdminApprovalsQueue";

export default function AdminApprovalsPage() {
  return (
    <DashboardLayout requiredRoles={["superAdmin"]}>
      <AdminApprovalsQueue />
    </DashboardLayout>
  );
}
