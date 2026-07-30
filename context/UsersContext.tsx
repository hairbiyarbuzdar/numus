import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { User } from "../types";
import { apiClient } from "../services/apiClient";
import { useAuth } from "./AuthContext";
import { createLazyFetch } from "../utils/lazyFetch";

interface UsersContextType {
  users: User[];
  loading: boolean;
  /** True once a fetch has completed for the current user — the cache is warm. */
  loaded: boolean;
  /** Loads the list if it isn't cached yet. Call this from a module that needs it. */
  ensureUsers: () => Promise<void>;
  /** Forces a refetch, cached or not. */
  refreshUsers: () => Promise<void>;
  setUserActive: (userId: string, isActive: boolean) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  updateUser: (userId: string, payload: Partial<Pick<User, "displayName" | "city" | "email">>) => Promise<void>;
}

const UsersContext = createContext<UsersContextType | undefined>(undefined);

/** `GET /auth/users` is an admin-only listing — nobody else should be asking for it. */
const canListUsers = (role?: string, userType?: string) => role === "superAdmin" || userType === "admin";

export const UsersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const isAdmin = canListUsers(user?.role, user?.userType);

  // Same caching rules as products — see utils/lazyFetch.ts.
  const cacheRef = useRef(createLazyFetch());

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) {
      // Nothing to fetch, but settle the state so callers don't retry in a loop.
      setUsers([]);
      setLoaded(true);
      return;
    }

    try {
      setLoading(true);
      const data = await apiClient.get<User[]>("/auth/users");
      setUsers(data);
    } catch {
      setUsers([]);
    } finally {
      setLoaded(true);
      setLoading(false);
    }
  }, [isAdmin]);

  const refreshUsers = useCallback(() => cacheRef.current.run(fetchUsers), [fetchUsers]);
  const ensureUsers = useCallback(() => cacheRef.current.ensure(fetchUsers), [fetchUsers]);

  // Signing in or out invalidates the cache.
  useEffect(() => {
    cacheRef.current.invalidate();
    setUsers([]);
    setLoaded(false);
  }, [user?.uid]);

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
    () => ({ users, loading, loaded, ensureUsers, refreshUsers, setUserActive, deleteUser, updateUser }),
    [ensureUsers, loaded, loading, refreshUsers, users]
  );

  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>;
};

export const useUsers = () => {
  const context = useContext(UsersContext);
  if (!context) throw new Error("useUsers must be used within a UsersProvider");
  return context;
};
