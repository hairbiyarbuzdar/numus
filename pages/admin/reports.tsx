import DashboardLayout from "../../layouts/DashboardLayout";

export default function AdminReportsPage() {
  return (
    <DashboardLayout requiredRoles={["superAdmin"]}>
      <div className="p-8">Reports (Coming Soon)</div>
    </DashboardLayout>
  );
}
