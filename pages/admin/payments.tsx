import DashboardLayout from "../../layouts/DashboardLayout";
import AdminModulePage from "../../views/admin/AdminModulePage";
import { payments } from "../../views/admin/adminData";

export default function AdminPaymentsPage() {
  return (
    <DashboardLayout requiredRoles={["superAdmin"]}>
      <AdminModulePage
        title="Payments Overview"
        subtitle="Track payouts, settlements, and pending disbursements."
        columns={["Payment Ref", "Order ID", "Payee", "Amount", "Status"]}
        rows={payments.map((payment) => [payment.ref, payment.orderId, payment.payee, payment.amount, payment.status])}
      />
    </DashboardLayout>
  );
}
