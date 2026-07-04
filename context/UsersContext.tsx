import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { User } from "../types";
import { apiClient } from "../services/apiClient";

interface UsersContextType {
  users: User[];
  loading: boolean;
  refreshUsers: () => Promise<void>;
  setUserActive: (userId: string, isActive: boolean) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  updateUser: (userId: string, payload: Partial<Pick<User, "displayName" | "city" | "email">>) => Promise<void>;
}

const UsersContext = createContext<UsersContextType | undefined>(undefined);

export const UsersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshUsers = async () => {
    try {
      const data = await apiClient.get<User[]>("/auth/users");
      setUsers(data);
    } catch {
      setUsers([]);
    }
  };

  useEffect(() => {
    void refreshUsers().finally(() => setLoading(false));
  }, []);

  const setUserActive = async (userId: string, isActive: boolean) => {
    await apiClient.patch(`/auth/users/${userId}/active`, { isActive });
    await refreshUsers();
  };

  const deleteUser = async (userId: string) => {
    await apiClient.delete(`/auth/users/${userId}`);
    await refreshUsers();
  };

  const updateUser = async (userId: string, payload: Partial<Pick<User, "displayName" | "city" | "email">>) => {
    await apiClient.patch(`/auth/users/${userId}`, payload);
    await refreshUsers();
  };

  const value = useMemo(
    () => ({ users, loading, refreshUsers, setUserActive, deleteUser, updateUser }),
    [loading, users]
  );

  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>;
};

export const useUsers = () => {
  const context = useContext(UsersContext);
  if (!context) throw new Error("useUsers must be used within a UsersProvider");
  return context;
};
