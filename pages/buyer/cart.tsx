import DashboardLayout from "../../layouts/DashboardLayout";
import Cart from "../../views/marketplace/Cart";

export default function BuyerCartPage() {
  return (
    <DashboardLayout requiredRoles={["buyer"]}>
      <Cart />
    </DashboardLayout>
  );
}
