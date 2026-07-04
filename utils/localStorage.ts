const isBrowser = () => typeof window !== "undefined";

export const readLocalStorage = <T,>(key: string, fallback: T): T => {
  if (!isBrowser()) return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const writeLocalStorage = (key: string, value: unknown) => {
  if (!isBrowser()) return;
  localStorage.setItem(key, JSON.stringify(value));
};

export const removeLocalStorage = (key: string) => {
  if (!isBrowser()) return;
  localStorage.removeItem(key);
};
