import React, { useState } from "react";
import { Loader2, Lock, ShieldCheck } from "lucide-react";

type Notice = { type: "success" | "error"; text: string } | null;

const PASSWORD_MIN_LENGTH = 8;

interface SetPasswordStepProps {
  email: string;
  loading: boolean;
  submitLabel: string;
  onSubmit: (password: string) => void | Promise<void>;
  setNotice: (notice: Notice) => void;
  compact?: boolean;
}

const SetPasswordStep: React.FC<SetPasswordStepProps> = ({
  email,
  loading,
  submitLabel,
  onSubmit,
  setNotice,
  compact = false,
}) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const inputClass = compact
    ? "w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 focus:border-emerald-500 focus:outline-none disabled:bg-gray-50"
    : "w-full rounded-xl border border-gray-300 py-3 pl-10 pr-3 focus:border-emerald-500 focus:outline-none disabled:bg-gray-50";
  const buttonClass = compact
    ? "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
    : "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    if (password.length < PASSWORD_MIN_LENGTH) {
      setNotice({ type: "error", text: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` });
      return;
    }
    if (password !== confirmPassword) {
      setNotice({ type: "error", text: "Passwords do not match." });
      return;
    }
    await onSubmit(password);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <p className="text-xs text-gray-500">
        Create a password for <span className="font-semibold text-emerald-700">{email}</span>
      </p>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">New Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className={inputClass}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Confirm Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            className={inputClass}
            placeholder="Re-enter your password"
            autoComplete="new-password"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        className={buttonClass}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {loading ? "Saving..." : submitLabel}
      </button>
    </form>
  );
};

export default SetPasswordStep;
