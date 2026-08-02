import { BulkTier, Product } from "../types";
import { apiClient, ApiActor } from "./apiClient";

/**
 * A cart line as the API returns it. Title, image and prices are joined from
 * the product on read, so a stored cart can never show a stale price. The unit
 * price after bulk tiers is still worked out on the client, which is where the
 * quantity the buyer is looking at lives.
 */
export interface CartLine {
  productId: string;
  title: string;
  image: string;
  vendorId: string;
  vendorName: string;
  basePrice: number;
  bulkTiers?: BulkTier[];
  qty: number;
  /** Set for an agreed one-off price, e.g. an auction buy-now. */
  customPrice?: number;
}

export interface MergeCartItem {
  productId: string;
  qty: number;
  customPrice?: number;
}

export const cartApi = {
  getCart(actor?: ApiActor) {
    return apiClient.get<CartLine[]>("/cart", { actor });
  },

  /** Adds to the existing quantity if the product is already in the cart. */
  addItem(productId: string, qty: number, customPrice?: number, actor?: ApiActor) {
    return apiClient.post<CartLine[]>("/cart", { productId, qty, customPrice }, { actor });
  },

  /** Sets an absolute quantity. */
  setQty(productId: string, qty: number, actor?: ApiActor) {
    return apiClient.patch<CartLine[]>(`/cart/${productId}`, { qty }, { actor });
  },

  removeItem(productId: string, actor?: ApiActor) {
    return apiClient.delete<CartLine[]>(`/cart/${productId}`, { actor });
  },

  clearCart(actor?: ApiActor) {
    return apiClient.delete<CartLine[]>("/cart", { actor });
  },

  /** Folds a signed-out browser's cart into the account at login. */
  mergeCart(items: MergeCartItem[], actor?: ApiActor) {
    return apiClient.post<CartLine[]>("/cart/merge", { items }, { actor });
  },
};

export const wishlistApi = {
  getWishlist(actor?: ApiActor) {
    return apiClient.get<Product[]>("/wishlist", { actor });
  },

  addItem(productId: string, actor?: ApiActor) {
    return apiClient.post<Product[]>("/wishlist", { productId }, { actor });
  },

  removeItem(productId: string, actor?: ApiActor) {
    return apiClient.delete<Product[]>(`/wishlist/${productId}`, { actor });
  },

  mergeWishlist(productIds: string[], actor?: ApiActor) {
    return apiClient.post<Product[]>("/wishlist/merge", { productIds }, { actor });
  },
};
