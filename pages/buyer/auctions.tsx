import DashboardLayout from "../../layouts/DashboardLayout";
import BuyerAuctions from "../../views/marketplace/BuyerAuctions";

export default function BuyerAuctionsPage() {
  return (
    <DashboardLayout requiredRoles={["buyer"]}>
      <BuyerAuctions />
    </DashboardLayout>
  );
}
