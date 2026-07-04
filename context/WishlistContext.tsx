import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Product } from "../types";
import { readLocalStorage, writeLocalStorage } from "../utils/localStorage";
import { useAuth } from "./AuthContext";

interface WishlistItem {
  userId: string;
  product: Product;
  addedAt: number;
}

interface WishlistContextType {
  wishlist: Product[];
  wishlistCount: number;
  isWishlisted: (productId: string) => boolean;
  addToWishlist: (product: Product) => { ok: boolean; message: string };
  removeFromWishlist: (productId: string) => void;
}

const STORAGE_KEY = "kissanhub_wishlist";

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readLocalStorage<WishlistItem[]>(STORAGE_KEY, []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeLocalStorage(STORAGE_KEY, items);
  }, [hydrated, items]);

  const wishlist = useMemo(
    () => items.filter((item) => item.userId === user?.uid).map((item) => item.product),
    [items, user?.uid]
  );

  const isWishlisted = (productId: string) => wishlist.some((product) => product.id === productId);

  const addToWishlist = (product: Product) => {
    if (!user) return { ok: false, message: "Please login first." };
    const exists = items.some((item) => item.userId === user.uid && item.product.id === product.id);
    if (exists) return { ok: false, message: "Already in wishlist." };

    setItems((prev) => [{ userId: user.uid, product, addedAt: Date.now() }, ...prev]);
    return { ok: true, message: "Added to wishlist." };
  };

  const removeFromWishlist = (productId: string) => {
    if (!user) return;
    setItems((prev) => prev.filter((item) => !(item.userId === user.uid && item.product.id === productId)));
  };

  const value = useMemo(
    () => ({
      wishlist,
      wishlistCount: wishlist.length,
      isWishlisted,
      addToWishlist,
      removeFromWishlist,
    }),
    [wishlist]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
};
