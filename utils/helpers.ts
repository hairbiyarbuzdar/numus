import { BulkTier } from '../types';

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount).replace('PKR', 'Rs');
};

export const calculateBulkPrice = (qty: number, basePrice: number, tiers?: BulkTier[]): number => {
  if (!tiers || tiers.length === 0) return basePrice;
  
  // Find the highest tier that matches the quantity
  const sortedTiers = [...tiers].sort((a, b) => b.qty - a.qty);
  const applicableTier = sortedTiers.find(t => qty >= t.qty);
  
  return applicableTier ? applicableTier.price : basePrice;
};

export const getTimeRemaining = (endTime: number) => {
  const total = endTime - Date.now();
  if (total <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  
  return { days, hours, minutes, seconds };
};
