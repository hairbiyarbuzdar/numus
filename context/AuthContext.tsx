import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../types";
import { authService, AuthUserType, OtpStartResult } from "../services/authService";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  requestOtp: (email: string, userType?: AuthUserType) => Promise<OtpStartResult>;
  verifyOtpAndLogin: (payload: {
    transactionId: string;
    email: string;
    otpCode: string;
    userType?: AuthUserType;
  }) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = authService.getSession();
    setUser(session?.user ?? null);
    setLoading(false);
  }, []);

  const requestOtp = async (email: string, userType?: AuthUserType) => {
    return authService.sendEmailOtp(email, userType);
  };

  const verifyOtpAndLogin = async ({
    transactionId,
    email,
    otpCode,
    userType,
  }: {
    transactionId: string;
    email: string;
    otpCode: string;
    userType?: AuthUserType;
  }) => {
    const { user: nextUser, token } = await authService.verifyEmailOtp(transactionId, email, otpCode);
    authService.saveSession(nextUser, token);
    setUser(nextUser);
    setAuthModalOpen(false);
    return nextUser;
  };

  const logout = () => {
    authService.clearSession();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authModalOpen,
        openAuthModal: () => setAuthModalOpen(true),
        closeAuthModal: () => setAuthModalOpen(false),
        requestOtp,
        verifyOtpAndLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
