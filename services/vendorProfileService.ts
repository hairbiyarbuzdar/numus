import { apiClient } from "./apiClient";
import { VendorProfileStatus } from "../types";

export interface VendorProfileFormData {
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

export interface VendorProfileRecord {
  vendorId: string;
  displayName: string;
  email: string;
  city: string;
  status: VendorProfileStatus;
  profile: VendorProfileFormData | null;
  submittedAt: number | null;
  reviewedAt: number | null;
  rejectionReason: string;
}

export const vendorProfileService = {
  async getMine(): Promise<VendorProfileRecord> {
    return apiClient.get<VendorProfileRecord>("/vendor-profile/me");
  },

  async submit(profile: VendorProfileFormData): Promise<VendorProfileRecord> {
    return apiClient.post<VendorProfileRecord>("/vendor-profile/submit", { profile });
  },

  async getQueue(): Promise<VendorProfileRecord[]> {
    return apiClient.get<VendorProfileRecord[]>("/vendor-profile/queue");
  },

  async approve(vendorId: string): Promise<VendorProfileRecord> {
    return apiClient.post<VendorProfileRecord>(`/vendor-profile/${vendorId}/approve`);
  },

  async reject(vendorId: string, reason: string): Promise<VendorProfileRecord> {
    return apiClient.post<VendorProfileRecord>(`/vendor-profile/${vendorId}/reject`, { reason });
  },
};
