import React, { useState } from "react";
import { useRouter } from "next/router";
import { CheckCircle2, Loader2, Mail, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { CITIES } from "../../constants";

interface AuthFlowProps {
  compact?: boolean;
  onSuccess?: () => void;
}

type Notice = { type: "success" | "error"; text: string } | null;
type RegisterType = "farmer" | "customer";

const sanitizeName = (value: string) => value.replace(/[^A-Za-z\s]/g, "").slice(0, 30);

const AuthFlow: React.FC<AuthFlowProps> = ({ compact = false, onSuccess }) => {
  const router = useRouter();
  const { loading, requestOtp, verifyOtpAndLogin } = useAuth();

  const [registerType, setRegisterType] = useState<RegisterType>("farmer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState(CITIES[0] || "");
  const [otpCode, setOtpCode] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSendOtp = !!name.trim() && isValidEmail;

  const redirectByRole = async (role: string) => {
    if (role === "superAdmin") await router.push("/admin");
    else if (role === "vendor") await router.push("/vendor");
    else await router.push("/buyer");
    onSuccess?.();
  };

  const handleSendOtp = async () => {
    setNotice(null);
    if (!name.trim()) {
      setNotice({ type: "error", text: "Full name is required." });
      return;
    }
    if (!isValidEmail) {
      setNotice({ type: "error", text: "Enter a valid email address." });
      return;
    }
    try {
      const result = await requestOtp(email.trim(), registerType);
      setTransactionId(result.transactionId);
      setOtpCode("");
      setOtpSent(true);
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
        userType: registerType,
      });
      await redirectByRole(nextUser.role);
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "OTP verification failed." });
    }
  };

  const cardClass = compact
    ? "w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
    : "w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-6 shadow-xl";

  return (
    <div className={cardClass}>
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
          <UserRound className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Create Account</h2>
          <p className="text-sm text-gray-500">Register as a farmer or customer</p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => { setRegisterType("farmer"); setNotice(null); setOtpSent(false); }}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
            registerType === "farmer" ? "bg-emerald-600 text-white" : "border border-gray-300 bg-white text-gray-700"
          }`}
        >
          Farmer
        </button>
        <button
          type="button"
          onClick={() => { setRegisterType("customer"); setNotice(null); setOtpSent(false); }}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
            registerType === "customer" ? "bg-emerald-600 text-white" : "border border-gray-300 bg-white text-gray-700"
          }`}
        >
          Customer
        </button>
      </div>

      <form className="space-y-4" onSubmit={handleVerify}>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Full Name</label>
          <input
            value={name}
            onChange={(e) => setName(sanitizeName(e.target.value))}
            disabled={loading || otpSent}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none disabled:bg-gray-50"
            placeholder="Enter your full name"
            maxLength={30}
          />
        </div>

        {registerType === "customer" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">City</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={otpSent}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 focus:border-emerald-500 focus:outline-none disabled:bg-gray-50"
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {!otpSent ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-28 focus:border-emerald-500 focus:outline-none disabled:bg-gray-50"
                placeholder="you@example.com"
              />
              <button
                type="button"
                onClick={() => void handleSendOtp()}
                disabled={loading || !canSendOtp}
                className="absolute right-1.5 top-1.5 inline-flex h-8 items-center justify-center rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send OTP"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">OTP (6 digits)</label>
              <button
                type="button"
                onClick={() => { setOtpSent(false); setOtpCode(""); setNotice(null); }}
                disabled={loading}
                className="text-xs font-medium text-emerald-700 hover:underline"
              >
                Change email
              </button>
            </div>
            <p className="mb-2 text-xs text-gray-500">
              Sent to <span className="font-semibold text-emerald-700">{email.trim()}</span>
            </p>
            <input
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              disabled={loading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 tracking-[0.35em] focus:border-emerald-500 focus:outline-none disabled:bg-gray-50"
              placeholder="000000"
            />
            <button
              type="submit"
              disabled={loading}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {loading ? "Verifying..." : "Verify & Create Account"}
            </button>
          </div>
        )}
      </form>

      {notice && (
        <p
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            notice.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {notice.type === "success" ? <CheckCircle2 className="mr-1 inline h-4 w-4" /> : null}
          {notice.text}
        </p>
      )}
    </div>
  );
};

export default AuthFlow;
