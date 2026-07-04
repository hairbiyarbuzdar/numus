import DashboardLayout from "../../layouts/DashboardLayout";
import BuyerOrders from "../../views/orders/BuyerOrders";

export default function BuyerOrdersPage() {
  return (
    <DashboardLayout requiredRoles={["buyer"]}>
      <BuyerOrders />
    </DashboardLayout>
  );
}
