import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useProducts } from "./ProductContext";
import { readLocalStorage, writeLocalStorage } from "../utils/localStorage";

export type OrderStatus = "Pending" | "Confirmed" | "Processing" | "Shipped" | "Delivered" | "Cancelled";

export interface OrderLine {
  productId: string;
  title: string;
  price: number;
  qty: number;
  image: string;
  vendorId: string;
  vendorName: string;
}

export interface OrderRecord {
  id: string;
  source: "checkout" | "auction";
  auctionId?: string;
  customerId: string;
  customerInfo: {
    fullName: string;
    phone: string;
    whatsapp: string;
    email: string;
  };
  addressInfo: {
    fullAddress: string;
    city: string;
    postalCode: string;
  };
  paymentMethod: "easypaisa" | "jazzcash" | "cod";
  items: OrderLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  createdAt: number;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
}

interface CreateCheckoutOrderPayload {
  customerId: string;
  customerInfo: OrderRecord["customerInfo"];
  addressInfo: OrderRecord["addressInfo"];
  paymentMethod: OrderRecord["paymentMethod"];
  items: OrderLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
}

interface OrdersContextType {
  orders: OrderRecord[];
  notifications: AppNotification[];
  createCheckoutOrder: (payload: CreateCheckoutOrderPayload) => string;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  markNotificationRead: (notificationId: string) => void;
}

const ORDER_STORAGE_KEY = "kissanhub_orders";
const NOTIF_STORAGE_KEY = "kissanhub_notifications";

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

const generateOrderId = () => {
  const stamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `ORD-${stamp}-${random}`;
};

export const OrdersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { products, closeExpiredAuctions, attachAuctionWinnerOrder } = useProducts();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
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

  useEffect(() => {
    setOrders(readLocalStorage<OrderRecord[]>(ORDER_STORAGE_KEY, []));
    setNotifications(readLocalStorage<AppNotification[]>(NOTIF_STORAGE_KEY, []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeLocalStorage(ORDER_STORAGE_KEY, orders);
  }, [orders, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeLocalStorage(NOTIF_STORAGE_KEY, notifications);
  }, [notifications, hydrated]);

  const createCheckoutOrder = (payload: CreateCheckoutOrderPayload) => {
    const newOrder: OrderRecord = {
      id: generateOrderId(),
      source: "checkout",
      customerId: payload.customerId,
      customerInfo: payload.customerInfo,
      addressInfo: payload.addressInfo,
      paymentMethod: payload.paymentMethod,
      items: payload.items,
      subtotal: payload.subtotal,
      deliveryFee: payload.deliveryFee,
      total: payload.total,
      status: "Pending",
      createdAt: Date.now(),
    };
    setOrders((prev) => [newOrder, ...prev]);
    return newOrder.id;
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status } : order)));
  };

  const markNotificationRead = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((notification) => (notification.id === notificationId ? { ...notification, read: true } : notification))
    );
  };

  const settleAuctions = useCallback(async () => {
    if (!hydrated) return;

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
      const auction = currentProducts.find((p) => p.id === ended.auctionId);
      if (!auction || auction.winnerOrderId) continue;

      const order: OrderRecord = {
        id: generateOrderId(),
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
            price: auction.currentHighestBid || auction.startingPrice || 0,
            qty: auction.auctionQuantity || 1,
            image: auction.images[0],
            vendorId: auction.vendorId,
            vendorName: auction.vendorName,
          },
        ],
        subtotal: (auction.currentHighestBid || auction.startingPrice || 0) * (auction.auctionQuantity || 1),
        deliveryFee: 0,
        total: (auction.currentHighestBid || auction.startingPrice || 0) * (auction.auctionQuantity || 1),
        status: "Pending",
        createdAt: Date.now(),
      };

      setOrders((prev) => [order, ...prev]);
      await attachAuctionWinnerOrderRef.current(auction.id, order.id);
      setNotifications((prev) => [
        {
          id: `NTF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          userId: ended.winnerBidderId,
          title: "Auction Won",
          message: `You won auction "${auction.title}". Order ${order.id} has been created.`,
          createdAt: Date.now(),
          read: false,
        },
        ...prev,
      ]);
    }
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    void settleAuctions();
    const timer = setInterval(() => {
      void settleAuctions();
    }, 15000);
    return () => clearInterval(timer);
  }, [hydrated, settleAuctions]);

  const value = useMemo(
    () => ({
      orders,
      notifications,
      createCheckoutOrder,
      updateOrderStatus,
      markNotificationRead,
    }),
    [notifications, orders]
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
