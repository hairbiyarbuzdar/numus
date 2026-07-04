import DashboardLayout from "../../layouts/DashboardLayout";

export default function AdminSettingsPage() {
  return (
    <DashboardLayout requiredRoles={["superAdmin"]}>
      <div className="p-8">Admin Settings (Coming Soon)</div>
    </DashboardLayout>
  );
}
