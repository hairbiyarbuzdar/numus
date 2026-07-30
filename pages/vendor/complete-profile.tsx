import DashboardLayout from "../../layouts/DashboardLayout";
import CompleteProfile from "../../views/vendor/CompleteProfile";

export default function VendorCompleteProfilePage() {
  return (
    <DashboardLayout requiredRoles={["vendor"]}>
      <CompleteProfile />
    </DashboardLayout>
  );
}
