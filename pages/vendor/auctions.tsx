import DashboardLayout from "../../layouts/DashboardLayout";
import VendorAuctions from "../../views/vendor/VendorAuctions";

export default function VendorAuctionsPage() {
  return (
    <DashboardLayout requiredRoles={["vendor"]}>
      <VendorAuctions />
    </DashboardLayout>
  );
}
