import { User } from "../types";
import { apiClient, ApiActor } from "./apiClient";

export type UserSort = "newest" | "oldest" | "name_asc" | "name_desc";

export type UserType = "farmer" | "customer" | "admin";

export interface UserQuery {
  /** Matches display name, email, phone or city. */
  search?: string;
  /** One type, or several as a comma-separated list (e.g. "farmer,customer"). */
  userType?: UserType | string;
  isActive?: boolean;
  sort?: UserSort;
  page?: number;
  pageSize?: number;
}

export interface PaginatedUsers {
  data: User[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

const buildQueryString = (query: UserQuery) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
};

export const userApi = {
  /** Bare array — admin only. Prefer listUsersPage for anything user-facing. */
  listUsers(actor?: ApiActor) {
    return apiClient.get<User[]>("/auth/users", { actor });
  },

  // Server-side search + filter + pagination. Always sends `page`/`pageSize`
  // so the API returns the paginated envelope rather than a bare array.
  listUsersPage(query: UserQuery, actor?: ApiActor) {
    const params: UserQuery = { ...query, page: query.page ?? 1, pageSize: query.pageSize ?? 10 };
    return apiClient.get<PaginatedUsers>(`/auth/users${buildQueryString(params)}`, { actor });
  },

  setUserActive(userId: string, isActive: boolean, actor?: ApiActor) {
    return apiClient.patch<User>(`/auth/users/${userId}/active`, { isActive }, { actor });
  },

  updateUser(
    userId: string,
    payload: Partial<Pick<User, "displayName" | "city" | "email">>,
    actor?: ApiActor
  ) {
    return apiClient.patch<User>(`/auth/users/${userId}`, payload, { actor });
  },

  deleteUser(userId: string, actor?: ApiActor) {
    return apiClient.delete<{ success: true }>(`/auth/users/${userId}`, { actor });
  },
};
