import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { BulkTier, Product } from '../types';
import { calculateBulkPrice } from '../utils/helpers';
import { readLocalStorage, writeLocalStorage } from '../utils/localStorage';
import { useAuth } from './AuthContext';
import { CartLine, cartApi } from '../services/cartApi';

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
  error: string | null;
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

  const applyLines = (lines: CartLine[]) => setCart(lines.map(lineToItem));

  const pushToast = (message: string) => setToast({ id: Date.now(), message });

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const refreshCart = useCallback(async () => {
    if (!user?.uid) return;
    try {
      setLoading(true);
      setError(null);
      applyLines(await cartApi.getCart());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your cart.");
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  // Guests read from this browser; signed-in buyers read from the database, and
  // anything in the guest basket is merged in once.
  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!user?.uid) {
        const stored = readLocalStorage<CartItem[]>(GUEST_STORAGE_KEY, []);
        guestCartRef.current = stored;
        if (active) setCart(stored);
        mergedForRef.current = null;
        return;
      }

      setLoading(true);
      try {
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

        if (active) {
          applyLines(lines);
          setError(null);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load your cart.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
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

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        error,
        addToCart,
        removeFromCart,
        updateQty,
        clearCart,
        refreshCart,
        isCartOpen,
        openCart: () => setIsCartOpen(true),
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
