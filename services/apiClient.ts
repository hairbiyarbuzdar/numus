import { readLocalStorage } from "../utils/localStorage";

// Kept for any existing call sites that pass actor — ignored now that we use JWT
export interface ApiActor {
  userId?: string;
  role?: string;
  name?: string;
}

interface RequestOptions extends RequestInit {
  actor?: ApiActor;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
const SESSION_KEY = "numu_auth_session";

const getToken = (): string | null => {
  const session = readLocalStorage<{ token: string } | null>(SESSION_KEY, null);
  return session?.token ?? null;
};

const buildHeaders = (options: RequestOptions = {}) => {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
};

const parseJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return data as T;
};

export const apiClient = {
  async get<T>(path: string, options: RequestOptions = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      method: "GET",
      headers: buildHeaders(options),
    });
    return parseJson<T>(response);
  },

  async post<T>(path: string, body?: unknown, options: RequestOptions = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      method: "POST",
      headers: buildHeaders(options),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return parseJson<T>(response);
  },

  async patch<T>(path: string, body?: unknown, options: RequestOptions = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      method: "PATCH",
      headers: buildHeaders(options),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return parseJson<T>(response);
  },

  async delete<T>(path: string, options: RequestOptions = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      method: "DELETE",
      headers: buildHeaders(options),
    });
    return parseJson<T>(response);
  },
};
