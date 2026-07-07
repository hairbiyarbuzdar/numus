import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../types";
import { authService, AuthUserType, OtpStartResult, PasswordSetupRequired } from "../services/authService";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  requestOtp: (email: string, userType?: AuthUserType) => Promise<OtpStartResult>;
  verifyOtp: (payload: {
    transactionId: string;
    email: string;
    otpCode: string;
  }) => Promise<PasswordSetupRequired>;
  completePasswordSetup: (transactionId: string, email: string, password: string) => Promise<User>;
  loginWithPassword: (email: string, password: string) => Promise<User>;
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

  const verifyOtp = async ({
    transactionId,
    email,
    otpCode,
  }: {
    transactionId: string;
    email: string;
    otpCode: string;
  }) => {
    return authService.verifyEmailOtp(transactionId, email, otpCode);
  };

  const completePasswordSetup = async (transactionId: string, email: string, password: string) => {
    const { user: nextUser, token } = await authService.setPassword(transactionId, email, password);
    authService.saveSession(nextUser, token);
    setUser(nextUser);
    setAuthModalOpen(false);
    return nextUser;
  };

  const loginWithPassword = async (email: string, password: string) => {
    const { user: nextUser, token } = await authService.loginWithPassword(email, password);
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
        verifyOtp,
        completePasswordSetup,
        loginWithPassword,
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
