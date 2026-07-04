import DashboardLayout from "../../layouts/DashboardLayout";

export default function AdminVendorsPage() {
  return (
    <DashboardLayout requiredRoles={["superAdmin"]}>
      <div className="p-8">Manage Vendors (Coming Soon)</div>
    </DashboardLayout>
  );
}
