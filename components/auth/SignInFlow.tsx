import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { CheckCircle2, Loader2, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

type SignInType = "farmer" | "customer";
type Notice = { type: "success" | "error"; text: string } | null;

const SignInFlow: React.FC = () => {
  const router = useRouter();
  const { loading, requestOtp, verifyOtpAndLogin } = useAuth();

  const [signInType, setSignInType] = useState<SignInType>("farmer");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [notice, setNotice] = useState<Notice>(null);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  useEffect(() => {
    if (!router.isReady) return;
    const nextType = router.query.type;
    if (nextType === "customer" || nextType === "farmer") {
      setSignInType(nextType);
    }
  }, [router.isReady, router.query.type]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const redirectByRole = async (role: string) => {
    if (role === "superAdmin") await router.push("/admin");
    else if (role === "vendor") await router.push("/vendor");
    else await router.push("/buyer");
  };

  const handleSendOtp = async () => {
    setNotice(null);
    if (!isValidEmail) {
      setNotice({ type: "error", text: "Enter a valid email address." });
      return;
    }
    try {
      const result = await requestOtp(email.trim(), signInType);
      setTransactionId(result.transactionId);
      setOtpCode("");
      setOtpSent(true);
      setCountdown(result.expiresInSeconds);
      setNotice({ type: "success", text: "OTP sent to your email. Check your inbox." });
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Failed to send OTP." });
    }
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    if (!/^\d{6}$/.test(otpCode)) {
      setNotice({ type: "error", text: "OTP must be exactly 6 digits." });
      return;
    }
    try {
      const nextUser = await verifyOtpAndLogin({
        transactionId,
        email: email.trim(),
        otpCode,
        userType: signInType,
      });
      await redirectByRole(nextUser.role);
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "OTP verification failed." });
    }
  };

  return (
    <div className="w-full max-w-xl">
      <div className="w-full rounded-3xl border border-white/70 bg-white/95 p-6 shadow-2xl shadow-emerald-100 backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Sign In</h2>
            <p className="text-sm text-gray-500">Enter your email to receive a one-time code</p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => { setSignInType("farmer"); setNotice(null); setOtpSent(false); }}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
              signInType === "farmer" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-600"
            }`}
          >
            Farmer
          </button>
          <button
            type="button"
            onClick={() => { setSignInType("customer"); setNotice(null); setOtpSent(false); }}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
              signInType === "customer" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-600"
            }`}
          >
            Customer
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleVerify}>
          {!otpSent ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-32 focus:border-emerald-500 focus:outline-none disabled:bg-gray-50"
                  placeholder="you@example.com"
                />
                <button
                  type="button"
                  onClick={() => void handleSendOtp()}
                  disabled={loading || !isValidEmail}
                  className="absolute right-1.5 top-1.5 inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send OTP"}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                A 6-digit code will be sent to your email address.
              </p>
            </div>
          ) : (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">Enter OTP</label>
                <button
                  type="button"
                  onClick={() => { setOtpSent(false); setOtpCode(""); setNotice(null); setCountdown(0); }}
                  disabled={loading}
                  className="text-xs font-medium text-emerald-700 hover:underline"
                >
                  Change email
                </button>
              </div>
              <p className="mb-3 text-xs text-gray-500">
                Code sent to <span className="font-semibold text-emerald-700">{email.trim()}</span>
                {countdown > 0 && <span className="ml-2 text-amber-500">expires in {countdown}s</span>}
              </p>
              <input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                disabled={loading}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 tracking-[0.35em] focus:border-emerald-500 focus:outline-none disabled:bg-gray-50"
                placeholder="000000"
              />
              <button
                type="submit"
                disabled={loading}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {loading ? "Verifying..." : `Sign In as ${signInType === "farmer" ? "Farmer" : "Customer"}`}
              </button>
            </div>
          )}
        </form>

        {notice && (
          <p
            className={`mt-4 rounded-xl px-4 py-3 text-sm ${
              notice.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}
          >
            {notice.type === "success" ? <CheckCircle2 className="mr-1 inline h-4 w-4" /> : null}
            {notice.text}
          </p>
        )}
      </div>
    </div>
  );
};

export default SignInFlow;
