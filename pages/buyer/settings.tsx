import DashboardLayout from "../../layouts/DashboardLayout";

export default function BuyerSettingsPage() {
  return (
    <DashboardLayout requiredRoles={["buyer"]}>
      <div className="p-8">Buyer Settings (Coming Soon)</div>
    </DashboardLayout>
  );
}
