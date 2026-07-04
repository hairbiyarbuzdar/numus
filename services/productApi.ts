import { Product } from "../types";
import { apiClient, ApiActor } from "./apiClient";

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

  createProduct(payload: CreateProductPayload, actor?: ApiActor) {
    return apiClient.post<Product>("/products", payload, { actor });
  },

  createAuction(payload: CreateAuctionPayload, actor?: ApiActor) {
    return apiClient.post<Product>("/products/auctions", payload, { actor });
  },

  deleteProduct(productId: string, actor?: ApiActor) {
    return apiClient.delete<{ success: true }>(`/products/${productId}`, { actor });
  },

  updateProduct(
    productId: string,
    payload: Partial<Pick<Product, "title" | "description" | "category" | "basePrice" | "stock" | "minOrderQty" | "images">>,
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
