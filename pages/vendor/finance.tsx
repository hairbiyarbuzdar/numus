import DashboardLayout from "../../layouts/DashboardLayout";

export default function VendorFinancePage() {
  return (
    <DashboardLayout requiredRoles={["vendor"]}>
      <div className="p-8">Vendor Finance (Coming Soon)</div>
    </DashboardLayout>
  );
}
