import DashboardLayout from "../../layouts/DashboardLayout";

export default function VendorSettingsPage() {
  return (
    <DashboardLayout requiredRoles={["vendor"]}>
      <div className="p-8">Vendor Settings (Coming Soon)</div>
    </DashboardLayout>
  );
}
