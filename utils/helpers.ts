import { BulkTier, Product, Role } from '../types';

/**
 * Where the Settings / Profile Settings links point for a given role. Mirrors
 * the Settings entry in components/Sidebar.tsx — the profile dropdown used to
 * hardcode its own path and drifted out of sync with it.
 */
export const getSettingsPath = (role?: Role) => {
  switch (role) {
    case 'superAdmin':
      return '/admin/settings';
    case 'vendor':
      return '/vendor/settings';
    default:
      return '/buyer/settings';
  }
};

export type AuctionDisplayStatus = 'pending' | 'rejected' | 'active' | 'ended' | 'cancelled';

/**
 * An auction carries two independent states: where it sits in the admin
 * approval workflow (`approvalStatus`) and where it sits in its own lifecycle
 * (`auctionStatus`, which the backend seeds as 'live' on creation).
 *
 * Approval gates the lifecycle — an auction is not "Active" until an admin has
 * approved it — so the workflow state wins whenever it is not yet 'approved'.
 */
export const getAuctionDisplayStatus = (auction: Product): AuctionDisplayStatus => {
  if (auction.approvalStatus === 'rejected') return 'rejected';
  // Treat a missing approvalStatus as pending: unreviewed, never "Active".
  if (auction.approvalStatus !== 'approved') return 'pending';

  if (auction.auctionStatus === 'cancelled') return 'cancelled';
  if (auction.auctionStatus === 'ended') return 'ended';
  return 'active';
};

export const AUCTION_STATUS_LABELS: Record<AuctionDisplayStatus, string> = {
  pending: 'Pending',
  rejected: 'Rejected',
  active: 'Active',
  ended: 'Ended',
  cancelled: 'Cancelled',
};

export const AUCTION_STATUS_BADGE_CLASSES: Record<AuctionDisplayStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
  active: 'bg-blue-100 text-blue-700',
  ended: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-orange-100 text-orange-700',
};

/**
 * Message the backend returns (and the UI shows) when an auction edit is
 * refused because bidding is already open.
 */
export const AUCTION_LOCKED_MESSAGE = 'Auction details cannot be modified after bidding has started.';

/**
 * Bidding opens at the start time. A missing start time means the auction opened
 * on creation (how the API seeds auctions with no explicit start date).
 */
export const hasAuctionStarted = (auction: Product) =>
  auction.auctionStartTime === undefined || Date.now() >= auction.auctionStartTime;

export const formatDateTime = (timestamp?: number) =>
  timestamp
    ? new Date(timestamp).toLocaleString('en-PK', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

export interface AuctionEditLock {
  editable: boolean;
  /** Why editing is blocked — shown when an edit is attempted on a locked auction. */
  reason?: string;
}

/**
 * An auction is editable only while it is still waiting to open: no bids placed
 * and its start time still in the future. Mirrors the guard on
 * `PATCH /products/:id/auction`, which is the authority — this is only here so
 * the UI can lock the form before a request is sent.
 */
export const getAuctionEditLock = (auction: Product): AuctionEditLock => {
  if (auction.auctionStatus === 'ended') {
    return { editable: false, reason: 'This auction has ended and can no longer be edited.' };
  }
  if (auction.auctionStatus === 'cancelled') {
    return { editable: false, reason: 'This auction was cancelled and can no longer be edited.' };
  }
  if ((auction.bids?.length || 0) > 0) {
    return { editable: false, reason: AUCTION_LOCKED_MESSAGE };
  }
  if (hasAuctionStarted(auction)) {
    return { editable: false, reason: AUCTION_LOCKED_MESSAGE };
  }
  return { editable: true };
};

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

/** Compact page window for a pagination bar, e.g. 1 … 4 5 6 … 12 */
export const buildPageList = (current: number, total: number): (number | 'gap')[] => {
  if (total <= 7) return Array.from({ length: total }, (_, idx) => idx + 1);

  const pages = new Set<number>([1, total, current]);
  if (current - 1 > 1) pages.add(current - 1);
  if (current + 1 < total) pages.add(current + 1);

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const withGaps: (number | 'gap')[] = [];
  sorted.forEach((page, idx) => {
    if (idx > 0 && page - sorted[idx - 1] > 1) withGaps.push('gap');
    withGaps.push(page);
  });
  return withGaps;
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
