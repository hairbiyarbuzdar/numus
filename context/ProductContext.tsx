import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Product } from "../types";
import { useAuth } from "./AuthContext";
import { productApi } from "../services/productApi";

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

interface ProductContextType {
  products: Product[];
  loading: boolean;
  error: string | null;
  refreshProducts: () => Promise<void>;
  addProduct: (payload: CreateProductPayload) => Promise<Product>;
  addAuction: (payload: CreateAuctionPayload) => Promise<Product>;
  deleteProduct: (productId: string) => Promise<void>;
  updateProduct: (
    productId: string,
    payload: Partial<Pick<Product, "title" | "description" | "category" | "basePrice" | "stock" | "minOrderQty" | "images">>
  ) => Promise<Product>;
  setProductActive: (productId: string, isActive: boolean) => Promise<Product>;
  approveProduct: (productId: string) => Promise<Product>;
  rejectProduct: (productId: string, reason?: string) => Promise<Product>;
  setVendorListingsVisibility: (vendorId: string, visible: boolean) => Promise<void>;
  placeBid: (payload: PlaceBidPayload) => Promise<{ ok: boolean; message: string }>;
  closeAuction: (productId: string) => Promise<{ ok: boolean; winnerBidderId?: string; winnerBidderName?: string }>;
  cancelAuction: (productId: string) => Promise<{ ok: boolean }>;
  closeExpiredAuctions: () => Promise<{ auctionId: string; winnerBidderId?: string; winnerBidderName?: string }[]>;
  attachAuctionWinnerOrder: (productId: string, orderId: string) => Promise<void>;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

const upsertProduct = (products: Product[], nextProduct: Product) => {
  const existingIndex = products.findIndex((product) => product.id === nextProduct.id);
  if (existingIndex === -1) {
    return [nextProduct, ...products];
  }

  const nextProducts = [...products];
  nextProducts[existingIndex] = nextProduct;
  return nextProducts;
};

const mergeProducts = (products: Product[], nextProducts: Product[]) => {
  const productMap = new Map(products.map((product) => [product.id, product]));
  nextProducts.forEach((product) => {
    productMap.set(product.id, product);
  });
  return Array.from(productMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const ProductProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const actor = useMemo(
    () => ({
      userId: user?.uid,
      role: user?.userType || user?.role,
      name: user?.displayName,
    }),
    [user]
  );

  const refreshProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const nextProducts = await productApi.listProducts(actor);
      setProducts(nextProducts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshProducts();
  }, [user?.uid]);

  const addProduct = async (payload: CreateProductPayload) => {
    const createdProduct = await productApi.createProduct(payload, actor);
    setProducts((prev) => upsertProduct(prev, createdProduct));
    setError(null);
    return createdProduct;
  };

  const addAuction = async (payload: CreateAuctionPayload) => {
    const createdAuction = await productApi.createAuction(payload, actor);
    setProducts((prev) => upsertProduct(prev, createdAuction));
    setError(null);
    return createdAuction;
  };

  const deleteProduct = async (productId: string) => {
    await productApi.deleteProduct(productId, actor);
    setProducts((prev) => prev.filter((product) => product.id !== productId));
    setError(null);
  };

  const updateProduct = async (
    productId: string,
    payload: Partial<Pick<Product, "title" | "description" | "category" | "basePrice" | "stock" | "minOrderQty" | "images">>
  ) => {
    const updatedProduct = await productApi.updateProduct(productId, payload, actor);
    setProducts((prev) => upsertProduct(prev, updatedProduct));
    setError(null);
    return updatedProduct;
  };

  const setProductActive = async (productId: string, isActive: boolean) => {
    const updatedProduct = await productApi.setProductVisibility(productId, isActive, actor);
    setProducts((prev) => upsertProduct(prev, updatedProduct));
    setError(null);
    return updatedProduct;
  };

  const approveProduct = async (productId: string) => {
    const updatedProduct = await productApi.approveProduct(productId, actor);
    setProducts((prev) => upsertProduct(prev, updatedProduct));
    setError(null);
    return updatedProduct;
  };

  const rejectProduct = async (productId: string, reason?: string) => {
    const updatedProduct = await productApi.rejectProduct(productId, reason, actor);
    setProducts((prev) => upsertProduct(prev, updatedProduct));
    setError(null);
    return updatedProduct;
  };

  const setVendorListingsVisibility = async (vendorId: string, visible: boolean) => {
    const updatedProducts = await productApi.setVendorListingsVisibility(vendorId, visible, actor);
    setProducts((prev) => mergeProducts(prev, updatedProducts));
    setError(null);
  };

  const placeBid = async (payload: PlaceBidPayload) => {
    try {
      const updatedProduct = await productApi.placeBid(payload, actor);
      setProducts((prev) => upsertProduct(prev, updatedProduct));
      setError(null);
      return { ok: true, message: "Bid placed successfully." };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "Auction not found.",
      };
    }
  };

  const closeAuction = async (productId: string) => {
    try {
      const result = await productApi.closeAuction(productId, actor);
      setProducts((prev) => upsertProduct(prev, result.product));
      setError(null);
      return {
        ok: true,
        winnerBidderId: result.winnerBidderId,
        winnerBidderName: result.winnerBidderName,
      };
    } catch {
      return { ok: false };
    }
  };

  const cancelAuction = async (productId: string) => {
    try {
      const updatedProduct = await productApi.cancelAuction(productId, actor);
      setProducts((prev) => upsertProduct(prev, updatedProduct));
      setError(null);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  };

  const closeExpiredAuctions = async () => {
    if (user?.role !== "superAdmin" && user?.userType !== "admin") {
      return [];
    }

    try {
      const results = await productApi.closeExpiredAuctions(actor);
      setProducts((prev) => mergeProducts(prev, results.map((entry) => entry.product)));
      setError(null);
      return results.map((entry) => ({
        auctionId: entry.product.id,
        winnerBidderId: entry.winnerBidderId,
        winnerBidderName: entry.winnerBidderName,
      }));
    } catch {
      return [];
    }
  };

  const attachAuctionWinnerOrder = async (productId: string, orderId: string) => {
    try {
      const updatedProduct = await productApi.attachAuctionWinnerOrder(productId, orderId, actor);
      setProducts((prev) => upsertProduct(prev, updatedProduct));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach winner order.");
    }
  };

  return (
    <ProductContext.Provider
      value={{
        products,
        loading,
        error,
        refreshProducts,
        addProduct,
        addAuction,
        deleteProduct,
        updateProduct,
        setProductActive,
        approveProduct,
        rejectProduct,
        setVendorListingsVisibility,
        placeBid,
        closeAuction,
        cancelAuction,
        closeExpiredAuctions,
        attachAuctionWinnerOrder,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error("useProducts must be used within a ProductProvider");
  }
  return context;
};
