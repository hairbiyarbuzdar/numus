import { useEffect } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "../../layouts/DashboardLayout";

function VendorHomeRedirect() {
  const router = useRouter();
  useEffect(() => {
    void router.replace("/vendor/products");
  }, [router]);
  return null;
}

export default function VendorDashboardPage() {
  return (
    <DashboardLayout requiredRoles={["vendor"]}>
      <VendorHomeRedirect />
    </DashboardLayout>
  );
}
