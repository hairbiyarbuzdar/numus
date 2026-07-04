import React, { createContext, useContext, useState, useEffect } from 'react';
import { BulkTier, Product } from '../types';
import { calculateBulkPrice } from '../utils/helpers';
import { readLocalStorage, writeLocalStorage } from '../utils/localStorage';
import { useAuth } from './AuthContext';

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
}

interface CartToast {
  id: number;
  message: string;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, qty: number, customPrice?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  toast: CartToast | null;
  clearToast: () => void;
  cartCount: number;
  cartTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [toast, setToast] = useState<CartToast | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const storageKey = user ? `kissanhub_cart_${user.uid}` : "kissanhub_cart_guest";

  // Load from local storage
  useEffect(() => {
    setHydrated(false);
    setCart(readLocalStorage<CartItem[]>(storageKey, []));
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    writeLocalStorage(storageKey, cart);
  }, [cart, hydrated, storageKey]);

  const pushToast = (message: string) => {
    setToast({ id: Date.now(), message });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const addToCart = (product: Product, qty: number, customPrice?: number) => {
    let feedback = `Added ${product.title} to cart`;
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      
      // If customPrice is provided (e.g. Auction Buy Now), use it. 
      // Otherwise calculate based on bulk tiers.
      let unitPrice = customPrice;
      if (unitPrice === undefined) {
          unitPrice = calculateBulkPrice(existing ? existing.qty + qty : qty, product.basePrice || 0, product.bulkTiers);
      }
      
      if (existing) {
        feedback = `Updated quantity for ${product.title}`;
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, qty: item.qty + qty, price: unitPrice! } 
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        title: product.title,
        image: product.images[0] ?? "",
        vendorId: product.vendorId,
        vendorName: product.vendorName,
        basePrice: customPrice ?? product.basePrice ?? 0,
        bulkTiers: product.bulkTiers,
        qty: qty,
        price: unitPrice!
      }];
    });
    pushToast(feedback);
  };

  const updateQty = (productId: string, qty: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId !== productId) return item;
      const nextQty = Math.max(1, qty);
      const unitPrice = calculateBulkPrice(nextQty, item.basePrice || 0, item.bulkTiers);
      return { ...item, qty: nextQty, price: unitPrice };
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const clearCart = () => setCart([]);
  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);
  const toggleCart = () => setIsCartOpen((prev) => !prev);
  const clearToast = () => setToast(null);

  const cartCount = cart.reduce((acc, item) => acc + item.qty, 0);
  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

  return (
    <CartContext.Provider value={{
      cart,
      addToCart,
      removeFromCart,
      updateQty,
      clearCart,
      isCartOpen,
      openCart,
      closeCart,
      toggleCart,
      toast,
      clearToast,
      cartCount,
      cartTotal,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
