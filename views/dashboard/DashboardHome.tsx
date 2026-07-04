import React, { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, FileBadge2, Loader2, Warehouse } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { readLocalStorage, writeLocalStorage } from "../../utils/localStorage";

type TabKey = "cnic" | "bank" | "warehouse";
type Notice = { type: "error" | "success"; text: string } | null;

interface FarmerProfileForm {
  cnicFrontImage: string;
  cnicBackImage: string;
  cnicNumber: string;
  cnicName: string;
  fatherName: string;
  cnicIssueDate: string;
  cnicExpiryDate: string;
  bankWalletName: string;
  accountTitle: string;
  accountNumber: string;
  branchName: string;
  branchCode: string;
  registeredMobileNumber: string;
  warehouseAddress: string;
  warehouseLocation: string;
  warehouseInfo: string;
}

interface StoredFarmerProfile {
  submitted: boolean;
  data: FarmerProfileForm;
  submittedAt?: number;
}

const emptyForm: FarmerProfileForm = {
  cnicFrontImage: "",
  cnicBackImage: "",
  cnicNumber: "",
  cnicName: "",
  fatherName: "",
  cnicIssueDate: "",
  cnicExpiryDate: "",
  bankWalletName: "",
  accountTitle: "",
  accountNumber: "",
  branchName: "",
  branchCode: "",
  registeredMobileNumber: "",
  warehouseAddress: "",
  warehouseLocation: "",
  warehouseInfo: "",
};

const bankOptions = [
  "UBL",
  "HBL",
  "Bank Alfalah",
  "ABL (Allied Bank)",
  "MCB",
  "Meezan Bank",
  "Bank of Punjab",
  "Askari Bank",
];

const walletOptions = ["Easypaisa", "JazzCash", "SadaPay", "NayaPay"];

const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: "cnic", label: "CNIC Details", icon: <FileBadge2 className="h-4 w-4" /> },
  { key: "bank", label: "Bank Details", icon: <Building2 className="h-4 w-4" /> },
  { key: "warehouse", label: "Warehouse Details", icon: <Warehouse className="h-4 w-4" /> },
];

const DashboardHome: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("cnic");
  const [form, setForm] = useState<FarmerProfileForm>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FarmerProfileForm, string>>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const storageKey = useMemo(() => `numu_farmer_profile_${user?.uid ?? "guest"}`, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const saved = readLocalStorage<StoredFarmerProfile | null>(storageKey, null);
    if (!saved) return;

    if (saved.data) {
      setForm({ ...emptyForm, ...saved.data });
    }
    if (saved.submitted) {
      setIsSubmitted(true);
    }
  }, [storageKey, user?.uid]);

  const requiredFields: Array<keyof FarmerProfileForm> = [
    "cnicFrontImage",
    "cnicBackImage",
    "cnicNumber",
    "cnicName",
    "fatherName",
    "cnicIssueDate",
    "cnicExpiryDate",
    "warehouseAddress",
    "warehouseLocation",
    "warehouseInfo",
  ];

  const persist = (payload: FarmerProfileForm, submitted: boolean) => {
    const next: StoredFarmerProfile = {
      submitted,
      data: payload,
      submittedAt: submitted ? Date.now() : undefined,
    };
    writeLocalStorage(storageKey, next);
  };

  const isValidMonthYear = (value: string) => {
    if (!/^\d{2}\/\d{4}$/.test(value)) return false;
    const month = Number(value.slice(0, 2));
    return month >= 1 && month <= 12;
  };

  const formatMonthYearInput = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    const monthDigits = digits.slice(0, 2);
    const month = Number(monthDigits);

    if (monthDigits.length === 2 && (month < 1 || month > 12)) {
      return "";
    }

    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2, 6)}`;
  };

  const isBankSelection = (value: string) => bankOptions.includes(value);
  const isWalletSelection = (value: string) => walletOptions.includes(value);

  const validateTab = (tab: TabKey) => {
    const nextErrors: Partial<Record<keyof FarmerProfileForm, string>> = { ...errors };

    const validateField = (field: keyof FarmerProfileForm, message: string) => {
      if (!form[field].trim()) nextErrors[field] = message;
      else delete nextErrors[field];
    };

    if (tab === "cnic") {
      validateField("cnicFrontImage", "CNIC front image is required.");
      validateField("cnicBackImage", "CNIC back image is required.");
      validateField("cnicNumber", "CNIC number is required.");
      validateField("cnicName", "CNIC name is required.");
      validateField("fatherName", "Father name is required.");
      validateField("cnicIssueDate", "CNIC issue date is required.");
      validateField("cnicExpiryDate", "CNIC expiry date is required.");

      if (form.cnicNumber && !/^\d{5}-\d{7}-\d{1}$/.test(form.cnicNumber.trim())) {
        nextErrors.cnicNumber = "Use CNIC format: 12345-1234567-1";
      }
      if (form.cnicIssueDate && !isValidMonthYear(form.cnicIssueDate.trim())) {
        nextErrors.cnicIssueDate = "Use valid format MM/YYYY with month 01-12.";
      }
      if (form.cnicExpiryDate && !isValidMonthYear(form.cnicExpiryDate.trim())) {
        nextErrors.cnicExpiryDate = "Use valid format MM/YYYY with month 01-12.";
      }
    }

    if (tab === "bank") {
      validateField("bankWalletName", "Bank / Wallet selection is required.");

      if (isBankSelection(form.bankWalletName)) {
        validateField("branchName", "Branch name is required.");
        validateField("branchCode", "Branch code is required.");
        validateField("accountTitle", "Account title is required.");
        validateField("accountNumber", "Account number is required.");

        if (form.accountNumber && !/^\d{8,24}$/.test(form.accountNumber.trim())) {
          nextErrors.accountNumber = "Account number must be 8 to 24 digits.";
        }
      }

      if (isWalletSelection(form.bankWalletName)) {
        validateField("registeredMobileNumber", "Registered mobile number is required.");
        if (form.registeredMobileNumber && !/^\d{10,15}$/.test(form.registeredMobileNumber.trim())) {
          nextErrors.registeredMobileNumber = "Registered mobile number must be 10 to 15 digits.";
        }
      }
    }

    if (tab === "warehouse") {
      validateField("warehouseAddress", "Warehouse address is required.");
      validateField("warehouseLocation", "Warehouse location is required.");
      validateField("warehouseInfo", "Warehouse description is required.");
    }

    setErrors(nextErrors);
    return !Object.keys(nextErrors).some((key) => {
      const field = key as keyof FarmerProfileForm;
      if (tab === "cnic") return ["cnicFrontImage", "cnicBackImage", "cnicNumber", "cnicName", "fatherName", "cnicIssueDate", "cnicExpiryDate"].includes(field);
      if (tab === "bank") {
        return ["bankWalletName", "accountTitle", "accountNumber", "branchName", "branchCode", "registeredMobileNumber"].includes(field);
      }
      return ["warehouseAddress", "warehouseLocation", "warehouseInfo"].includes(field);
    });
  };

  const validateAll = () => {
    const nextErrors: Partial<Record<keyof FarmerProfileForm, string>> = {};

    requiredFields.forEach((field) => {
      if (!form[field].trim()) {
        nextErrors[field] = "This field is required.";
      }
    });

    if (form.cnicNumber && !/^\d{5}-\d{7}-\d{1}$/.test(form.cnicNumber.trim())) {
      nextErrors.cnicNumber = "Use CNIC format: 12345-1234567-1";
    }
    if (form.cnicIssueDate && !isValidMonthYear(form.cnicIssueDate.trim())) {
      nextErrors.cnicIssueDate = "Use valid format MM/YYYY with month 01-12.";
    }
    if (form.cnicExpiryDate && !isValidMonthYear(form.cnicExpiryDate.trim())) {
      nextErrors.cnicExpiryDate = "Use valid format MM/YYYY with month 01-12.";
    }

    if (!form.bankWalletName.trim()) {
      nextErrors.bankWalletName = "Bank / Wallet selection is required.";
    }

    if (isBankSelection(form.bankWalletName)) {
      if (!form.branchName.trim()) nextErrors.branchName = "Branch name is required.";
      if (!form.branchCode.trim()) nextErrors.branchCode = "Branch code is required.";
      if (!form.accountTitle.trim()) nextErrors.accountTitle = "Account title is required.";
      if (!form.accountNumber.trim()) nextErrors.accountNumber = "Account number is required.";
      if (form.accountNumber && !/^\d{8,24}$/.test(form.accountNumber.trim())) {
        nextErrors.accountNumber = "Account number must be 8 to 24 digits.";
      }
    }

    if (isWalletSelection(form.bankWalletName)) {
      if (!form.registeredMobileNumber.trim()) {
        nextErrors.registeredMobileNumber = "Registered mobile number is required.";
      }
      if (form.registeredMobileNumber && !/^\d{10,15}$/.test(form.registeredMobileNumber.trim())) {
        nextErrors.registeredMobileNumber = "Registered mobile number must be 10 to 15 digits.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleImageUpload = (field: "cnicFrontImage" | "cnicBackImage", file?: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({ ...prev, [field]: "Please upload a valid image file." }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result);
      setForm((prev) => {
        const next = { ...prev, [field]: value };
        persist(next, false);
        return next;
      });
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  const updateField = (field: keyof FarmerProfileForm, value: string) => {
    if (isSubmitted) return;

    setForm((prev) => {
      const next = { ...prev, [field]: value };
      persist(next, false);
      return next;
    });

    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const updateMonthYearField = (field: "cnicIssueDate" | "cnicExpiryDate", value: string) => {
    if (isSubmitted) return;

    setForm((prev) => {
      const previousValue = prev[field];
      const masked = formatMonthYearInput(value);
      const nextValue = masked || (value === "" ? "" : previousValue);
      const next = { ...prev, [field]: nextValue };
      persist(next, false);
      return next;
    });

    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const moveTab = (direction: "next" | "prev") => {
    const tabOrder: TabKey[] = ["cnic", "bank", "warehouse"];
    const index = tabOrder.indexOf(activeTab);

    if (direction === "next") {
      const valid = validateTab(activeTab);
      if (!valid) return;
      if (index < tabOrder.length - 1) setActiveTab(tabOrder[index + 1]);
      return;
    }

    if (index > 0) setActiveTab(tabOrder[index - 1]);
  };

  const handleSubmit = async () => {
    setNotice(null);

    if (!validateAll()) {
      setNotice({ type: "error", text: "Please complete all required fields correctly." });
      return;
    }

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 900));

    persist(form, true);
    setIsSubmitted(true);
    setIsSubmitting(false);
    setNotice({ type: "success", text: "Profile submitted successfully." });
  };

  if (isSubmitted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-2xl border border-emerald-100 bg-white p-10 text-center shadow-sm">
        <div>
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Profile Under Review</h1>
          <p className="mt-2 text-gray-600">You will receive an email soon.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Farmer Profile Setup</h1>
        <p className="text-sm text-gray-500">Complete all tabs to submit your account details.</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  activeTab === tab.key
                    ? "bg-emerald-600 text-white"
                    : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="transition-opacity duration-200">
            {activeTab === "cnic" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">CNIC Front Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload("cnicFrontImage", e.target.files?.[0])}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                  {form.cnicFrontImage && (
                    <img src={form.cnicFrontImage} alt="CNIC front preview" className="mt-2 h-24 w-40 rounded-lg border object-cover" />
                  )}
                  {errors.cnicFrontImage && <p className="mt-1 text-xs text-red-600">{errors.cnicFrontImage}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">CNIC Back Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload("cnicBackImage", e.target.files?.[0])}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                  {form.cnicBackImage && (
                    <img src={form.cnicBackImage} alt="CNIC back preview" className="mt-2 h-24 w-40 rounded-lg border object-cover" />
                  )}
                  {errors.cnicBackImage && <p className="mt-1 text-xs text-red-600">{errors.cnicBackImage}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">CNIC Number</label>
                  <input
                    value={form.cnicNumber}
                    onChange={(e) => updateField("cnicNumber", e.target.value)}
                    placeholder="12345-1234567-1"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                  />
                  {errors.cnicNumber && <p className="mt-1 text-xs text-red-600">{errors.cnicNumber}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">CNIC Name</label>
                  <input
                    value={form.cnicName}
                    onChange={(e) => updateField("cnicName", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                  />
                  {errors.cnicName && <p className="mt-1 text-xs text-red-600">{errors.cnicName}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Father Name</label>
                  <input
                    value={form.fatherName}
                    onChange={(e) => updateField("fatherName", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                  />
                  {errors.fatherName && <p className="mt-1 text-xs text-red-600">{errors.fatherName}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">CNIC Issue Date</label>
                  <input
                    type="text"
                    value={form.cnicIssueDate}
                    onChange={(e) => updateMonthYearField("cnicIssueDate", e.target.value)}
                    inputMode="numeric"
                    maxLength={7}
                    placeholder="MM/YYYY"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                  />
                  {errors.cnicIssueDate && <p className="mt-1 text-xs text-red-600">{errors.cnicIssueDate}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">CNIC Expiry Date</label>
                  <input
                    type="text"
                    value={form.cnicExpiryDate}
                    onChange={(e) => updateMonthYearField("cnicExpiryDate", e.target.value)}
                    inputMode="numeric"
                    maxLength={7}
                    placeholder="MM/YYYY"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                  />
                  {errors.cnicExpiryDate && <p className="mt-1 text-xs text-red-600">{errors.cnicExpiryDate}</p>}
                </div>
              </div>
            )}

            {activeTab === "bank" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Bank / Wallet Name</label>
                  <select
                    value={form.bankWalletName}
                    onChange={(e) => {
                      const value = e.target.value;
                      setForm((prev) => {
                        const next = {
                          ...prev,
                          bankWalletName: value,
                          branchName: "",
                          branchCode: "",
                          accountTitle: "",
                          accountNumber: "",
                          registeredMobileNumber: "",
                        };
                        persist(next, false);
                        return next;
                      });
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.bankWalletName;
                        delete next.branchName;
                        delete next.branchCode;
                        delete next.accountTitle;
                        delete next.accountNumber;
                        delete next.registeredMobileNumber;
                        return next;
                      });
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Select bank or wallet</option>
                    <optgroup label="Banks">
                      {bankOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Mobile Wallets">
                      {walletOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  {errors.bankWalletName && <p className="mt-1 text-xs text-red-600">{errors.bankWalletName}</p>}
                </div>

                {isBankSelection(form.bankWalletName) && (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Branch Name</label>
                      <input
                        value={form.branchName}
                        onChange={(e) => updateField("branchName", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                      />
                      {errors.branchName && <p className="mt-1 text-xs text-red-600">{errors.branchName}</p>}
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Branch Code</label>
                      <input
                        value={form.branchCode}
                        onChange={(e) => updateField("branchCode", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                      />
                      {errors.branchCode && <p className="mt-1 text-xs text-red-600">{errors.branchCode}</p>}
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Account Title</label>
                      <input
                        value={form.accountTitle}
                        onChange={(e) => updateField("accountTitle", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                      />
                      {errors.accountTitle && <p className="mt-1 text-xs text-red-600">{errors.accountTitle}</p>}
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Account Number</label>
                      <input
                        value={form.accountNumber}
                        onChange={(e) => updateField("accountNumber", e.target.value.replace(/\D/g, ""))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                      />
                      {errors.accountNumber && <p className="mt-1 text-xs text-red-600">{errors.accountNumber}</p>}
                    </div>
                  </>
                )}

                {isWalletSelection(form.bankWalletName) && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Registered Mobile Number</label>
                    <input
                      value={form.registeredMobileNumber}
                      onChange={(e) => updateField("registeredMobileNumber", e.target.value.replace(/\D/g, ""))}
                      placeholder="03XXXXXXXXX"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                    />
                    {errors.registeredMobileNumber && <p className="mt-1 text-xs text-red-600">{errors.registeredMobileNumber}</p>}
                  </div>
                )}

                {!isBankSelection(form.bankWalletName) && !isWalletSelection(form.bankWalletName) && (
                  <div className="md:col-span-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-sm text-gray-500">
                    Select a bank or wallet to continue entering details.
                  </div>
                )}
              </div>
            )}

            {activeTab === "warehouse" && (
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Warehouse Address</label>
                  <input
                    value={form.warehouseAddress}
                    onChange={(e) => updateField("warehouseAddress", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                  />
                  {errors.warehouseAddress && <p className="mt-1 text-xs text-red-600">{errors.warehouseAddress}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Warehouse Location (City/Area)</label>
                  <input
                    value={form.warehouseLocation}
                    onChange={(e) => updateField("warehouseLocation", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                  />
                  {errors.warehouseLocation && <p className="mt-1 text-xs text-red-600">{errors.warehouseLocation}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Warehouse Description / Information</label>
                  <textarea
                    rows={4}
                    value={form.warehouseInfo}
                    onChange={(e) => updateField("warehouseInfo", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                  />
                  {errors.warehouseInfo && <p className="mt-1 text-xs text-red-600">{errors.warehouseInfo}</p>}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => moveTab("prev")}
                disabled={activeTab === "cnic"}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => moveTab("next")}
                disabled={activeTab === "warehouse"}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Submitting..." : "Submit Profile"}
            </button>
          </div>
        </div>
      </div>

      {notice && (
        <p className={`rounded-lg px-3 py-2 text-sm ${notice.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
          {notice.text}
        </p>
      )}
    </div>
  );
};

export default DashboardHome;
