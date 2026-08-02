import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Product } from "../types";
import { readLocalStorage, writeLocalStorage } from "../utils/localStorage";
import { useAuth } from "./AuthContext";
import { wishlistApi } from "../services/cartApi";

interface WishlistContextType {
  wishlist: Product[];
  wishlistCount: number;
  loading: boolean;
  error: string | null;
  isWishlisted: (productId: string) => boolean;
  addToWishlist: (product: Product) => Promise<{ ok: boolean; message: string }>;
  removeFromWishlist: (productId: string) => Promise<void>;
  refreshWishlist: () => Promise<void>;
}

/** Only read now, to fold a pre-existing browser wishlist into the account once. */
const LEGACY_STORAGE_KEY = "kissanhub_wishlist";

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshWishlist = useCallback(async () => {
    if (!user?.uid) {
      setWishlist([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setWishlist(await wishlistApi.getWishlist());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your wishlist.");
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!user?.uid) {
        setWishlist([]);
        return;
      }

      setLoading(true);
      try {
        // Anything saved in this browser before the wishlist moved server-side
        // is merged into the account once, then dropped.
        const legacy = readLocalStorage<{ userId: string; product: Product }[]>(LEGACY_STORAGE_KEY, []);
        const mine = legacy.filter((entry) => entry.userId === user.uid && entry.product?.id);

        const items = mine.length
          ? await wishlistApi.mergeWishlist(mine.map((entry) => entry.product.id))
          : await wishlistApi.getWishlist();

        if (mine.length) {
          writeLocalStorage(
            LEGACY_STORAGE_KEY,
            legacy.filter((entry) => entry.userId !== user.uid)
          );
        }

        if (active) {
          setWishlist(items);
          setError(null);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load your wishlist.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [user?.uid]);

  const isWishlisted = useCallback(
    (productId: string) => wishlist.some((product) => product.id === productId),
    [wishlist]
  );

  const addToWishlist = useCallback(
    async (product: Product) => {
      if (!user) return { ok: false, message: "Please login first." };
      if (wishlist.some((item) => item.id === product.id)) {
        return { ok: false, message: "Already in wishlist." };
      }

      try {
        setWishlist(await wishlistApi.addItem(product.id));
        setError(null);
        return { ok: true, message: "Added to wishlist." };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not add to your wishlist.";
        setError(message);
        return { ok: false, message };
      }
    },
    [user, wishlist]
  );

  const removeFromWishlist = useCallback(
    async (productId: string) => {
      if (!user) return;
      try {
        setWishlist(await wishlistApi.removeItem(productId));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not remove that item.");
      }
    },
    [user]
  );

  const value = useMemo(
    () => ({
      wishlist,
      wishlistCount: wishlist.length,
      loading,
      error,
      isWishlisted,
      addToWishlist,
      removeFromWishlist,
      refreshWishlist,
    }),
    [addToWishlist, error, isWishlisted, loading, refreshWishlist, removeFromWishlist, wishlist]
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
