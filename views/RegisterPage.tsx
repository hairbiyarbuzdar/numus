import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { APP_NAME } from "../constants";
import { useAuth } from "../context/AuthContext";
import AuthFlow from "../components/auth/AuthFlow";

const RegisterPage: React.FC = () => {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;
    if (user.role === "superAdmin") {
      void router.replace("/admin");
      return;
    }
    void router.replace(user.role === "vendor" ? "/vendor" : "/buyer");
  }, [loading, router, user]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-cyan-50 p-4">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-8 py-10">
        <div className="text-center">
          <div className="mx-auto mb-4 h-20 w-20 rounded-2xl bg-white p-1 shadow-md">
            <img src="/numulogo.png" alt="Logo" className="h-full w-full object-cover" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900">{APP_NAME}</h1>
          <p className="mt-2 text-gray-600">Create your farmer or customer account</p>
        </div>
        <AuthFlow />
        <div className="text-center">
          <Link href="/" className="text-sm text-gray-500 underline hover:text-gray-900">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
