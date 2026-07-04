import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: number;
}

interface NotificationsContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
const SOCKET_URL = API_BASE.replace("/api", "");

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const socketRef = useRef<import("socket.io-client").Socket | null>(null);

  // Fetch existing notifications from backend
  const fetchNotifications = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: {
          "x-user-id": user.uid,
          "x-user-role": user.userType || user.role,
          "x-user-name": user.displayName,
        },
      });
      if (!res.ok) return;
      const data: AppNotification[] = await res.json();
      setNotifications(data);
    } catch (_) {}
  }, [user?.uid]);

  // Add a new notification to the top of the list (from socket)
  const addNotification = useCallback((notif: AppNotification) => {
    setNotifications((prev) => {
      // Avoid duplicates
      if (prev.some((n) => n.id === notif.id)) return prev;
      return [notif, ...prev];
    });
  }, []);

  // Connect socket.io
  useEffect(() => {
    if (!user?.uid) return;

    // Dynamically import to avoid SSR issues
    import("socket.io-client").then(({ io }) => {
      const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("join", { userId: user.uid });
      });

      // Listen for all notification events the backend emits
      const EVENTS = ["new_order", "product_approved", "product_rejected", "order_status", "auction_ended"];
      EVENTS.forEach((event) => {
        socket.on(event, (data: { notification?: AppNotification }) => {
          if (data?.notification) addNotification(data.notification);
        });
      });
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [user?.uid, addNotification]);

  // Fetch on mount / user change
  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const markRead = useCallback(async (id: string) => {
    if (!user?.uid) return;
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: "PATCH",
        headers: { "x-user-id": user.uid, "x-user-role": user.userType || user.role, "x-user-name": user.displayName },
      });
    } catch (_) {}
  }, [user?.uid]);

  const markAllRead = useCallback(async () => {
    if (!user?.uid) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: "PATCH",
        headers: { "x-user-id": user.uid, "x-user-role": user.userType || user.role, "x-user-name": user.displayName },
      });
    } catch (_) {}
  }, [user?.uid]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markRead, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be within NotificationsProvider");
  return ctx;
};
