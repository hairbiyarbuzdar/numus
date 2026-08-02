import { apiClient, ApiActor } from "./apiClient";

export type OrderStatus =
  | "Pending"
  | "Confirmed"
  | "Processing"
  | "Shipped"
  | "Delivered"
  | "Cancelled";

export type OrderSource = "checkout" | "auction";

export type OrderSort = "newest" | "oldest" | "total_desc" | "total_asc";

export interface OrderItem {
  productId: string;
  vendorId: string;
  vendorName?: string;
  title: string;
  price: number;
  qty: number;
  image?: string;
}

export interface OrderRecord {
  id: string;
  source: OrderSource;
  auctionId?: string;
  customerId: string;
  customerInfo: {
    fullName: string;
    phone: string;
    whatsapp?: string;
    email?: string;
  };
  addressInfo: {
    fullAddress: string;
    city: string;
    postalCode?: string;
    notes?: string;
  };
  paymentMethod: "easypaisa" | "jazzcash" | "cod";
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  createdAt: number;
}

export interface OrderQuery {
  /** Matches order id, buyer name, phone, or any product title in the order. */
  search?: string;
  status?: OrderStatus;
  source?: OrderSource;
  /** Admin-only narrowing; other roles are scoped by the API itself. */
  customerId?: string;
  vendorId?: string;
  /** Epoch milliseconds. */
  dateFrom?: number;
  dateTo?: number;
  sort?: OrderSort;
  page?: number;
  pageSize?: number;
}

export interface PaginatedOrders {
  data: OrderRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface OrderSummary {
  totalOrders: number;
  byStatus: Record<OrderStatus, number>;
  /** All orders in scope. For a vendor, only their own items count. */
  grossRevenue: number;
  /** Delivered orders only — money actually realised. */
  earnedRevenue: number;
}

export interface CreateOrderPayload {
  customerId: string;
  customerInfo: OrderRecord["customerInfo"];
  addressInfo: OrderRecord["addressInfo"];
  paymentMethod: OrderRecord["paymentMethod"];
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  source?: OrderSource;
  auctionId?: string;
}

const buildQueryString = (query: OrderQuery) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
};

export const orderApi = {
  /** Bare array — the API scopes it to the caller's role. */
  listOrders(actor?: ApiActor) {
    return apiClient.get<OrderRecord[]>("/orders", { actor });
  },

  // Server-side search + filter + pagination. Always sends `page`/`pageSize`
  // so the API returns the paginated envelope rather than a bare array.
  listOrdersPage(query: OrderQuery, actor?: ApiActor) {
    const params: OrderQuery = { ...query, page: query.page ?? 1, pageSize: query.pageSize ?? 10 };
    return apiClient.get<PaginatedOrders>(`/orders${buildQueryString(params)}`, { actor });
  },

  getSummary(query: Omit<OrderQuery, "page" | "pageSize" | "sort"> = {}, actor?: ApiActor) {
    return apiClient.get<OrderSummary>(`/orders/summary${buildQueryString(query)}`, { actor });
  },

  createOrder(payload: CreateOrderPayload, actor?: ApiActor) {
    return apiClient.post<OrderRecord>("/orders", payload, { actor });
  },

  updateOrderStatus(orderId: string, status: OrderStatus, actor?: ApiActor) {
    return apiClient.patch<OrderRecord>(`/orders/${orderId}/status`, { status }, { actor });
  },
};
