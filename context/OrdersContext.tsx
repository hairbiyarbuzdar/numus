import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useProducts } from "./ProductContext";
import { useAuth } from "./AuthContext";
import { readLocalStorage, writeLocalStorage } from "../utils/localStorage";
import { createLazyFetch } from "../utils/lazyFetch";
import { CreateOrderPayload, OrderRecord, OrderStatus, orderApi } from "../services/orderApi";

export type { OrderStatus, OrderRecord } from "../services/orderApi";
export type { OrderItem as OrderLine } from "../services/orderApi";

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
}

type CreateCheckoutOrderPayload = Omit<CreateOrderPayload, "source" | "auctionId">;

interface OrdersContextType {
  orders: OrderRecord[];
  notifications: AppNotification[];
  loading: boolean;
  /** True once orders have been fetched for the current user — the cache is warm. */
  loaded: boolean;
  error: string | null;
  /** Loads orders if they aren't cached yet. Call this from a module that needs them. */
  ensureOrders: () => Promise<void>;
  /** Forces a refetch, cached or not. */
  refreshOrders: () => Promise<void>;
  createCheckoutOrder: (payload: CreateCheckoutOrderPayload) => Promise<string>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  markNotificationRead: (notificationId: string) => void;
  /**
   * Closes auctions past their end time and raises an order for each winner.
   * Admin-only and driven by the Auctions page rather than a global timer.
   */
  settleAuctions: () => Promise<void>;
}

const NOTIF_STORAGE_KEY = "kissanhub_notifications";
const SETTLE_INTERVAL_MS = 15000;

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export const OrdersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { products, closeExpiredAuctions, attachAuctionWinnerOrder } = useProducts();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const productsRef = useRef(products);
  const closeExpiredAuctionsRef = useRef(closeExpiredAuctions);
  const attachAuctionWinnerOrderRef = useRef(attachAuctionWinnerOrder);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    closeExpiredAuctionsRef.current = closeExpiredAuctions;
  }, [closeExpiredAuctions]);

  useEffect(() => {
    attachAuctionWinnerOrderRef.current = attachAuctionWinnerOrder;
  }, [attachAuctionWinnerOrder]);

  // Orders live in the database; only these local auction-won notices are still
  // browser-stored (the API-backed feed is NotificationsContext).
  useEffect(() => {
    setNotifications(readLocalStorage<AppNotification[]>(NOTIF_STORAGE_KEY, []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeLocalStorage(NOTIF_STORAGE_KEY, notifications);
  }, [notifications, hydrated]);

  // Same lazy-cache rules as products and users — see utils/lazyFetch.ts.
  const cacheRef = useRef(createLazyFetch());

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // The API scopes the list by role: buyers get their own orders, vendors
      // get orders containing their items, admins get everything.
      const nextOrders = await orderApi.listOrders();
      setOrders(nextOrders);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshOrders = useCallback(
    () => cacheRef.current.run(fetchOrders).catch(() => undefined),
    [fetchOrders]
  );

  const ensureOrders = useCallback(
    () => cacheRef.current.ensure(fetchOrders).catch(() => undefined),
    [fetchOrders]
  );

  // Signing in or out invalidates the cache — orders are scoped to the caller.
  useEffect(() => {
    cacheRef.current.invalidate();
    setOrders([]);
    setLoaded(false);
    setError(null);
  }, [user?.uid]);

  const createCheckoutOrder = useCallback(async (payload: CreateCheckoutOrderPayload) => {
    const order = await orderApi.createOrder({ ...payload, source: "checkout" });
    setOrders((prev) => [order, ...prev.filter((existing) => existing.id !== order.id)]);
    return order.id;
  }, []);

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    const updated = await orderApi.updateOrderStatus(orderId, status);
    setOrders((prev) => prev.map((order) => (order.id === updated.id ? updated : order)));
  }, []);

  const markNotificationRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((notification) => (notification.id === notificationId ? { ...notification, read: true } : notification))
    );
  }, []);

  /**
   * Closes auctions whose end time has passed and raises an order for each
   * winner.
   *
   * Admin-only on purpose: orders are shared now, so if every signed-in browser
   * ran this they would race to create duplicate orders for the same auction.
   * `closeExpiredAuctions` already no-ops for other roles. The right long-term
   * home for this is the backend close-expired-auctions job — see CHANGES.md.
   */
  const settleAuctions = useCallback(async () => {
    const isAdmin = user?.role === "superAdmin" || user?.userType === "admin";
    if (!isAdmin) return;

    const currentProducts = productsRef.current;
    const endedAuctions = await closeExpiredAuctionsRef.current();
    const manualEnded = currentProducts
      .filter((product) => product.isAuction && product.auctionStatus === "ended" && !product.winnerOrderId)
      .map((product) => ({
        auctionId: product.id,
        winnerBidderId: product.winnerBidderId,
        winnerBidderName: product.winnerBidderName,
      }));

    const allEndedMap = new Map<string, { auctionId: string; winnerBidderId?: string; winnerBidderName?: string }>();
    [...endedAuctions, ...manualEnded].forEach((entry) => {
      allEndedMap.set(entry.auctionId, entry);
    });
    const allEnded = Array.from(allEndedMap.values());
    if (!allEnded.length) return;

    for (const ended of allEnded) {
      if (!ended.winnerBidderId) continue;
      const auction = currentProducts.find((product) => product.id === ended.auctionId);
      // winnerOrderId is the guard against raising a second order for the same auction.
      if (!auction || auction.winnerOrderId) continue;

      const unitPrice = auction.currentHighestBid || auction.startingPrice || 0;
      const qty = auction.auctionQuantity || 1;

      try {
        const order = await orderApi.createOrder({
          source: "auction",
          auctionId: auction.id,
          customerId: ended.winnerBidderId,
          customerInfo: {
            fullName: ended.winnerBidderName || "Auction Winner",
            phone: "N/A",
            whatsapp: "N/A",
            email: "N/A",
          },
          addressInfo: {
            fullAddress: "Pending shipping details",
            city: "N/A",
            postalCode: "N/A",
          },
          paymentMethod: "cod",
          items: [
            {
              productId: auction.id,
              title: auction.title,
              price: unitPrice,
              qty,
              image: auction.images[0],
              vendorId: auction.vendorId,
              vendorName: auction.vendorName,
            },
          ],
          subtotal: unitPrice * qty,
          deliveryFee: 0,
          total: unitPrice * qty,
        });

        setOrders((prev) => [order, ...prev.filter((existing) => existing.id !== order.id)]);
        await attachAuctionWinnerOrderRef.current(auction.id, order.id);
        setNotifications((prev) => [
          {
            id: `NTF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            userId: ended.winnerBidderId as string,
            title: "Auction Won",
            message: `You won auction "${auction.title}". Order ${order.id} has been created.`,
            createdAt: Date.now(),
            read: false,
          },
          ...prev,
        ]);
      } catch {
        // A failed settlement is retried on the next tick rather than surfaced —
        // the auction stays without a winner order until it succeeds.
      }
    }
  }, [user?.role, user?.userType]);

  // Deliberately not run on a global timer. It used to fire on sign-in and
  // every 15 seconds from whatever page the admin happened to be on, which is
  // a POST from every open tab regardless of what the admin was doing. The
  // Auctions page drives it now — see AdminAuctionsManager.

  const value = useMemo(
    () => ({
      orders,
      notifications,
      loading,
      loaded,
      error,
      ensureOrders,
      refreshOrders,
      createCheckoutOrder,
      updateOrderStatus,
      markNotificationRead,
      settleAuctions,
    }),
    [
      createCheckoutOrder,
      ensureOrders,
      error,
      loaded,
      loading,
      markNotificationRead,
      notifications,
      orders,
      refreshOrders,
      settleAuctions,
      updateOrderStatus,
    ]
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
};

export const useOrders = () => {
  const context = useContext(OrdersContext);
  if (!context) {
    throw new Error("useOrders must be used within an OrdersProvider");
  }
  return context;
};
