import { Product, ProductApprovalStatus, ProductStatus, ProductType } from "../types";
import { apiClient, ApiActor } from "./apiClient";

export type ProductSort =
  | "newest"
  | "oldest"
  | "title_asc"
  | "title_desc"
  | "price_asc"
  | "price_desc"
  | "stock_asc"
  | "stock_desc"
  | "ending_soonest"
  | "ending_latest"
  | "bid_asc"
  | "bid_desc";

/** The status an auction shows in the admin views — see getAuctionDisplayStatus. */
export type AuctionState = "pending" | "active" | "rejected" | "ended" | "cancelled";

/** Which timestamp a dateFrom/dateTo range applies to. */
export type ProductDateField = "created" | "start" | "end";

export interface ProductQuery {
  /** Matches title, description, category, vendor name or product/auction id. */
  search?: string;
  status?: ProductStatus;
  approvalStatus?: ProductApprovalStatus;
  productType?: ProductType;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  auctionState?: AuctionState;
  dateField?: ProductDateField;
  /** Epoch milliseconds — the caller decides where the day boundaries fall. */
  dateFrom?: number;
  dateTo?: number;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
}

export interface PaginatedProducts {
  data: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

const buildQueryString = (query: ProductQuery) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
};

interface CreateProductPayload {
  vendorId: string;
  vendorName: string;
  title: string;
  description: string;
  category: string;
  image: string;
  productType: "retail" | "wholesale";
  basePrice: number;
  stock: number;
  minOrderQty: number;
  status?: ProductStatus;
}

interface CreateAuctionPayload {
  vendorId: string;
  vendorName: string;
  title: string;
  description: string;
  category: string;
  image: string;
  startingPrice: number;
  bidIncrement: number;
  auctionStartTime?: number;
  auctionEndTime?: number;
  auctionQuantity?: number;
  buyNowPrice?: number;
  durationDays: number;
}

// Only accepted while the auction is still waiting to open — the API rejects
// the request once bidding has started.
export interface UpdateAuctionPayload {
  title?: string;
  description?: string;
  category?: string;
  images?: string[];
  startingPrice?: number;
  bidIncrement?: number;
  auctionQuantity?: number;
  /** `null` clears the buy-now price. */
  buyNowPrice?: number | null;
  auctionStartTime?: number;
  auctionEndTime?: number;
}

interface PlaceBidPayload {
  productId: string;
  bidderId: string;
  bidderName: string;
  amount: number;
}

interface CloseAuctionResponse {
  product: Product;
  winnerBidderId?: string;
  winnerBidderName?: string;
}

export const productApi = {
  listProducts(actor?: ApiActor) {
    return apiClient.get<Product[]>("/products", { actor });
  },

  // Server-side search + filter + pagination. Always sends `page`/`pageSize`
  // so the API returns the paginated envelope rather than a bare array.
  listProductsPage(query: ProductQuery, actor?: ApiActor) {
    const params: ProductQuery = {
      ...query,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
    };
    return apiClient.get<PaginatedProducts>(`/products${buildQueryString(params)}`, { actor });
  },

  // `productType` scopes the options (e.g. only categories that auctions use).
  listFilterOptions(query: Pick<ProductQuery, "productType"> = {}, actor?: ApiActor) {
    return apiClient.get<{ categories: string[] }>(
      `/products/filter-options${buildQueryString(query)}`,
      { actor }
    );
  },

  createProduct(payload: CreateProductPayload, actor?: ApiActor) {
    return apiClient.post<Product>("/products", payload, { actor });
  },

  createAuction(payload: CreateAuctionPayload, actor?: ApiActor) {
    return apiClient.post<Product>("/products/auctions", payload, { actor });
  },

  updateAuction(productId: string, payload: UpdateAuctionPayload, actor?: ApiActor) {
    return apiClient.patch<Product>(`/products/${productId}/auction`, payload, { actor });
  },

  deleteProduct(productId: string, actor?: ApiActor) {
    return apiClient.delete<{ success: true }>(`/products/${productId}`, { actor });
  },

  updateProduct(
    productId: string,
    payload: Partial<Pick<Product, "title" | "description" | "category" | "basePrice" | "stock" | "minOrderQty" | "images" | "status">>,
    actor?: ApiActor
  ) {
    return apiClient.patch<Product>(`/products/${productId}`, payload, { actor });
  },

  setProductVisibility(productId: string, isActive: boolean, actor?: ApiActor) {
    return apiClient.patch<Product>(`/products/${productId}/visibility`, { isActive }, { actor });
  },

  approveProduct(productId: string, actor?: ApiActor) {
    return apiClient.post<Product>(`/products/${productId}/approve`, {}, { actor });
  },

  rejectProduct(productId: string, reason?: string, actor?: ApiActor) {
    return apiClient.post<Product>(`/products/${productId}/reject`, { reason }, { actor });
  },

  setVendorListingsVisibility(vendorId: string, visible: boolean, actor?: ApiActor) {
    return apiClient.patch<Product[]>(`/products/vendors/${vendorId}/visibility`, { isActive: visible }, { actor });
  },

  placeBid(payload: PlaceBidPayload, actor?: ApiActor) {
    return apiClient.post<Product>(`/products/${payload.productId}/bids`, payload, { actor });
  },

  closeAuction(productId: string, actor?: ApiActor) {
    return apiClient.post<CloseAuctionResponse>(`/products/${productId}/close-auction`, {}, { actor });
  },

  cancelAuction(productId: string, actor?: ApiActor) {
    return apiClient.post<Product>(`/products/${productId}/cancel-auction`, {}, { actor });
  },

  closeExpiredAuctions(actor?: ApiActor) {
    return apiClient.post<CloseAuctionResponse[]>("/products/close-expired-auctions", {}, { actor });
  },

  attachAuctionWinnerOrder(productId: string, orderId: string, actor?: ApiActor) {
    return apiClient.patch<Product>(`/products/${productId}/winner-order`, { orderId }, { actor });
  },
};
