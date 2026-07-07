import { User } from "../types";
import { apiClient } from "./apiClient";
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from "../utils/localStorage";

export type AuthUserType = "farmer" | "customer" | "admin";

export interface OtpStartResult {
  transactionId: string;
  expiresInSeconds: number;
  devCode: string;
}

export interface PasswordSetupRequired {
  transactionId: string;
  email: string;
  needsPassword: true;
}

interface AuthSession {
  token: string;
  user: User;
}

const SESSION_KEY = "numu_auth_session";

export const authService = {
  getSession(): AuthSession | null {
    return readLocalStorage<AuthSession | null>(SESSION_KEY, null);
  },

  getToken(): string | null {
    return this.getSession()?.token ?? null;
  },

  saveSession(user: User, token: string): AuthSession {
    const session: AuthSession = { token, user };
    writeLocalStorage(SESSION_KEY, session);
    return session;
  },

  clearSession() {
    removeLocalStorage(SESSION_KEY);
  },

  async sendEmailOtp(email: string, userType?: AuthUserType): Promise<OtpStartResult> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) throw new Error("Email is required.");
    return apiClient.post<OtpStartResult>("/auth/email/otp/request", {
      email: normalized,
      userType,
    });
  },

  async verifyEmailOtp(
    transactionId: string,
    email: string,
    code: string
  ): Promise<PasswordSetupRequired> {
    return apiClient.post<PasswordSetupRequired>("/auth/email/otp/verify", {
      transactionId,
      email: email.trim().toLowerCase(),
      otpCode: code.trim(),
    });
  },

  async setPassword(
    transactionId: string,
    email: string,
    password: string
  ): Promise<{ user: User; token: string }> {
    const result = await apiClient.post<User & { token: string }>("/auth/set-password", {
      transactionId,
      email: email.trim().toLowerCase(),
      password,
    });
    const { token, ...user } = result;
    return { user: user as User, token };
  },

  async loginWithPassword(email: string, password: string): Promise<{ user: User; token: string }> {
    const result = await apiClient.post<User & { token: string }>("/auth/email/login", {
      email: email.trim().toLowerCase(),
      password,
    });
    const { token, ...user } = result;
    return { user: user as User, token };
  },
};
