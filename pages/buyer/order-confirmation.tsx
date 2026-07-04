import DashboardLayout from "../../layouts/DashboardLayout";
import OrderConfirmation from "../../views/marketplace/OrderConfirmation";

export default function BuyerOrderConfirmationPage() {
  return (
    <DashboardLayout requiredRoles={["buyer"]}>
      <OrderConfirmation />
    </DashboardLayout>
  );
}
