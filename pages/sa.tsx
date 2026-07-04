import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AlertCircle, Eye, EyeOff, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";

type Step = "email" | "otp";

export default function SuperAdminLoginPage() {
  const { user, loading, requestOtp, verifyOtpAndLogin } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const inputClassName =
    "w-full rounded-lg border border-gray-300 bg-white py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 disabled:bg-gray-50 disabled:text-gray-500";
  const primaryButtonClassName =
    "w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-100 transition hover:bg-emerald-700 disabled:opacity-60";

  useEffect(() => {
    if (!loading && user?.role === "superAdmin") {
      void router.replace("/admin");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setTimeout(() => setCountdown((currentCount) => currentCount - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter the admin email address.");
      return;
    }

    setBusy(true);

    try {
      const result = await requestOtp(email.trim(), "admin");
      setTransactionId(result.transactionId);
      setCountdown(result.expiresInSeconds);
      setStep("otp");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP.");
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!otp.trim()) {
      setError("Please enter the verification code.");
      return;
    }

    setBusy(true);

    try {
      const loggedInUser = await verifyOtpAndLogin({
        transactionId,
        email: email.trim(),
        otpCode: otp.trim(),
        userType: "admin",
      });

      if (loggedInUser.role !== "superAdmin") {
        setError("Access denied. This login is restricted to Super Admins only.");
        return;
      }

      void router.replace("/admin");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-cyan-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-emerald-50 via-white to-cyan-50 px-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(16,185,129,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.18) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-300/35 blur-[110px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-cyan-200/40 blur-[90px]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-md shadow-emerald-100 ring-1 ring-emerald-100">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Super Admin Portal</h1>
          <p className="mt-1.5 text-sm text-gray-600">Restricted access — authorised personnel only</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
          <div className="mb-6 flex items-center gap-3">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                step === "email" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              1
            </div>
            <div className={`h-px flex-1 ${step === "otp" ? "bg-emerald-500/50" : "bg-gray-200"}`} />
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                step === "otp" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              2
            </div>
          </div>

          {step === "email" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Admin Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="admin@numu.com.pk"
                    className={`${inputClassName} pl-9 pr-3`}
                    disabled={busy}
                    autoComplete="email"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error}
                </div>
              )}

              <button type="submit" disabled={busy} className={primaryButtonClassName}>
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                  </span>
                ) : (
                  "Send Verification Code"
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Verification Code
                </label>
                <p className="mb-3 text-xs text-gray-500">
                  Code sent to <span className="font-semibold text-emerald-700">{email}</span>
                  {countdown > 0 && <span className="ml-2 text-amber-500">expires in {countdown}s</span>}
                </p>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showCode ? "text" : "password"}
                    value={otp}
                    onChange={(event) => setOtp(event.target.value)}
                    placeholder="6-digit code"
                    maxLength={6}
                    className={`${inputClassName} pl-9 pr-10`}
                    disabled={busy}
                    autoComplete="one-time-code"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCode((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error}
                </div>
              )}

              <button type="submit" disabled={busy} className={primaryButtonClassName}>
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
                  </span>
                ) : (
                  "Access Dashboard"
                )}
              </button>

              <button
                type="button"
                onClick={() => { setStep("email"); setOtp(""); setError(""); }}
                className="w-full text-center text-xs text-gray-500 hover:text-gray-700"
              >
                ← Use a different email
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          Numu Platform &copy; {new Date().getFullYear()} — Super Admin Access
        </p>
      </div>
    </div>
  );
}
