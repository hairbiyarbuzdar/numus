import DashboardLayout from "../../layouts/DashboardLayout";
import Marketplace from "../../views/marketplace/Marketplace";

export default function BuyerMarketplacePage() {
  return (
    <DashboardLayout requiredRoles={["buyer"]}>
      <Marketplace />
    </DashboardLayout>
  );
}
