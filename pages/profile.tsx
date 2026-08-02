import { useEffect } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import { getSettingsPath } from "../utils/helpers";

// The profile dropdown used to link here, which left vendors on a generic stub
// instead of their own settings page. It now links straight to the role's
// settings route; this page stays behind as a redirect so existing links and
// bookmarks still land somewhere useful.
export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;
    void router.replace(getSettingsPath(user.role));
  }, [loading, router, user]);

  return (
    <DashboardLayout>
      <div className="p-8 text-gray-600">Taking you to your settings…</div>
    </DashboardLayout>
  );
}
