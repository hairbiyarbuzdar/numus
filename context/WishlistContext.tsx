import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Product } from "../types";
import { readLocalStorage, writeLocalStorage } from "../utils/localStorage";
import { useAuth } from "./AuthContext";
import { wishlistApi } from "../services/cartApi";
import { meApi } from "../services/meApi";
import { createLazyFetch } from "../utils/lazyFetch";

interface WishlistContextType {
  wishlist: Product[];
  wishlistCount: number;
  loading: boolean;
  /** True once the wishlist has been fetched for this user. */
  loaded: boolean;
  error: string | null;
  /** Loads the wishlist if it isn't cached yet — call this from a page that needs it. */
  ensureWishlist: () => Promise<void>;
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
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef(createLazyFetch());
  // Header badge before the list itself has been fetched.
  const [badgeCount, setBadgeCount] = useState(0);

  const fetchWishlist = useCallback(async () => {
    if (!user?.uid) {
      setWishlist([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

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

      setWishlist(items);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your wishlist.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  const refreshWishlist = useCallback(
    () => cacheRef.current.run(fetchWishlist).catch(() => undefined),
    [fetchWishlist]
  );

  const ensureWishlist = useCallback(
    () => cacheRef.current.ensure(fetchWishlist).catch(() => undefined),
    [fetchWishlist]
  );

  // Only the header count is fetched on sign-in; the list itself waits until a
  // page that needs it is opened.
  useEffect(() => {
    cacheRef.current.invalidate();
    setWishlist([]);
    setLoaded(false);
    setError(null);

    if (!user?.uid) {
      setBadgeCount(0);
      return;
    }

    let active = true;
    void meApi
      .getBadges()
      .then((badges) => {
        if (active) setBadgeCount(badges.wishlistCount);
      })
      .catch(() => {
        if (active) setBadgeCount(0);
      });

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
        setLoaded(true);
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
      // Before the list is fetched the header shows the count from /me/badges.
      wishlistCount: loaded ? wishlist.length : badgeCount,
      loading,
      loaded,
      error,
      ensureWishlist,
      isWishlisted,
      addToWishlist,
      removeFromWishlist,
      refreshWishlist,
    }),
    [addToWishlist, badgeCount, ensureWishlist, error, isWishlisted, loaded, loading, refreshWishlist, removeFromWishlist, wishlist]
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
