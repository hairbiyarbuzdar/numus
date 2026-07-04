import DashboardLayout from "../../layouts/DashboardLayout";
import Checkout from "../../views/marketplace/Checkout";

export default function BuyerCheckoutPage() {
  return (
    <DashboardLayout requiredRoles={["buyer"]}>
      <Checkout />
    </DashboardLayout>
  );
}
