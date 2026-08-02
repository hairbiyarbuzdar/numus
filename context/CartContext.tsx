import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { BulkTier, Product } from '../types';
import { calculateBulkPrice } from '../utils/helpers';
import { readLocalStorage, writeLocalStorage } from '../utils/localStorage';
import { useAuth } from './AuthContext';
import { CartLine, cartApi } from '../services/cartApi';
import { meApi } from '../services/meApi';
import { createLazyFetch } from '../utils/lazyFetch';

export interface CartItem {
  productId: string;
  title: string;
  image: string;
  vendorId: string;
  vendorName: string;
  basePrice: number;
  bulkTiers?: BulkTier[];
  qty: number;
  price: number; // Unit price after bulk calc
  customPrice?: number;
}

interface CartToast {
  id: number;
  message: string;
}

interface CartContextType {
  cart: CartItem[];
  loading: boolean;
  /** True once the cart contents have been fetched for this user. */
  loaded: boolean;
  error: string | null;
  /** Loads the cart if it isn't cached yet — call this from the Cart page/drawer. */
  ensureCart: () => Promise<void>;
  addToCart: (product: Product, qty: number, customPrice?: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  updateQty: (productId: string, qty: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  toast: CartToast | null;
  clearToast: () => void;
  cartCount: number;
  cartTotal: number;
}

const GUEST_STORAGE_KEY = "kissanhub_cart_guest";

const CartContext = createContext<CartContextType | undefined>(undefined);

/** The API stores product + quantity; the unit price after bulk tiers is worked out here. */
const lineToItem = (line: CartLine): CartItem => ({
  productId: line.productId,
  title: line.title,
  image: line.image,
  vendorId: line.vendorId,
  vendorName: line.vendorName,
  basePrice: line.basePrice,
  bulkTiers: line.bulkTiers,
  qty: line.qty,
  customPrice: line.customPrice,
  price: line.customPrice ?? calculateBulkPrice(line.qty, line.basePrice || 0, line.bulkTiers),
});

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [toast, setToast] = useState<CartToast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signed-out visitors still get a basket, kept in this browser and folded
  // into their account the first time they sign in.
  const isGuest = !user?.uid;
  const guestCartRef = useRef<CartItem[]>([]);
  const mergedForRef = useRef<string | null>(null);

  const [loaded, setLoaded] = useState(false);
  const cacheRef = useRef(createLazyFetch());
  // Until the contents are fetched, the header badge falls back to the count
  // from /me/badges so it isn't wrong on pages that never open the cart.
  const [badgeCount, setBadgeCount] = useState(0);

  const applyLines = (lines: CartLine[]) => {
    setCart(lines.map(lineToItem));
    setLoaded(true);
  };

  const pushToast = (message: string) => setToast({ id: Date.now(), message });

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  /**
   * Fetches the cart contents. A basket built before signing in is merged into
   * the account the first time this runs for that user.
   */
  const fetchCart = useCallback(async () => {
    if (!user?.uid) return;
    try {
      setLoading(true);
      setError(null);

      const pending = readLocalStorage<CartItem[]>(GUEST_STORAGE_KEY, []);
      let lines: CartLine[];

      if (pending.length && mergedForRef.current !== user.uid) {
        lines = await cartApi.mergeCart(
          pending.map((item) => ({ productId: item.productId, qty: item.qty, customPrice: item.customPrice }))
        );
        writeLocalStorage(GUEST_STORAGE_KEY, []);
        guestCartRef.current = [];
        mergedForRef.current = user.uid;
      } else {
        lines = await cartApi.getCart();
      }

      applyLines(lines);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your cart.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  const refreshCart = useCallback(
    () => cacheRef.current.run(fetchCart).catch(() => undefined),
    [fetchCart]
  );

  const ensureCart = useCallback(
    () => cacheRef.current.ensure(fetchCart).catch(() => undefined),
    [fetchCart]
  );

  // Nothing is fetched on sign-in except the header counts; the contents load
  // when the cart page or drawer is opened. Guests read from this browser,
  // which costs no request at all.
  useEffect(() => {
    cacheRef.current.invalidate();
    meApi.reset();
    setLoaded(false);
    setError(null);

    if (!user?.uid) {
      const stored = readLocalStorage<CartItem[]>(GUEST_STORAGE_KEY, []);
      guestCartRef.current = stored;
      setCart(stored);
      setBadgeCount(stored.reduce((sum, item) => sum + item.qty, 0));
      mergedForRef.current = null;
      return;
    }

    setCart([]);
    let active = true;
    void meApi
      .getBadges()
      .then((badges) => {
        if (active) setBadgeCount(badges.cartCount);
      })
      .catch(() => {
        if (active) setBadgeCount(0);
      });

    return () => {
      active = false;
    };
  }, [user?.uid]);

  /** Guest baskets are the only thing still written to this browser. */
  const persistGuest = (next: CartItem[]) => {
    guestCartRef.current = next;
    writeLocalStorage(GUEST_STORAGE_KEY, next);
    setCart(next);
  };

  const addToCart = async (product: Product, qty: number, customPrice?: number) => {
    if (isGuest) {
      const existing = guestCartRef.current.find((item) => item.productId === product.id);
      const nextQty = existing ? existing.qty + qty : qty;
      const unitPrice = customPrice ?? calculateBulkPrice(nextQty, product.basePrice || 0, product.bulkTiers);
      const line: CartItem = {
        productId: product.id,
        title: product.title,
        image: product.images[0] ?? "",
        vendorId: product.vendorId,
        vendorName: product.vendorName,
        basePrice: customPrice ?? product.basePrice ?? 0,
        bulkTiers: product.bulkTiers,
        qty: nextQty,
        price: unitPrice,
        customPrice,
      };
      persistGuest(
        existing
          ? guestCartRef.current.map((item) => (item.productId === product.id ? line : item))
          : [...guestCartRef.current, line]
      );
      pushToast(existing ? `Updated quantity for ${product.title}` : `Added ${product.title} to cart`);
      return;
    }

    try {
      const wasInCart = cart.some((item) => item.productId === product.id);
      applyLines(await cartApi.addItem(product.id, qty, customPrice));
      setError(null);
      pushToast(wasInCart ? `Updated quantity for ${product.title}` : `Added ${product.title} to cart`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not add that to your cart.";
      setError(message);
      pushToast(message);
      throw err;
    }
  };

  const updateQty = async (productId: string, qty: number) => {
    const nextQty = Math.max(1, qty);

    if (isGuest) {
      persistGuest(
        guestCartRef.current.map((item) =>
          item.productId === productId
            ? { ...item, qty: nextQty, price: item.customPrice ?? calculateBulkPrice(nextQty, item.basePrice || 0, item.bulkTiers) }
            : item
        )
      );
      return;
    }

    try {
      applyLines(await cartApi.setQty(productId, nextQty));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the quantity.");
      throw err;
    }
  };

  const removeFromCart = async (productId: string) => {
    if (isGuest) {
      persistGuest(guestCartRef.current.filter((item) => item.productId !== productId));
      return;
    }

    try {
      applyLines(await cartApi.removeItem(productId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that item.");
      throw err;
    }
  };

  const clearCart = async () => {
    if (isGuest) {
      persistGuest([]);
      return;
    }

    try {
      applyLines(await cartApi.clearCart());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clear your cart.");
      throw err;
    }
  };

  // Once the contents are loaded they are the truth; before that the header
  // shows the count from /me/badges.
  const cartCount = loaded || isGuest ? cart.reduce((sum, item) => sum + item.qty, 0) : badgeCount;
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        loaded,
        error,
        ensureCart,
        addToCart,
        removeFromCart,
        updateQty,
        clearCart,
        refreshCart,
        isCartOpen,
        // Opening the drawer is one of the moments the contents are needed.
        openCart: () => {
          void ensureCart();
          setIsCartOpen(true);
        },
        closeCart: () => setIsCartOpen(false),
        toggleCart: () => setIsCartOpen((prev) => !prev),
        toast,
        clearToast: () => setToast(null),
        cartCount,
        cartTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
