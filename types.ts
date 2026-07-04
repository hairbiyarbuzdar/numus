import React from 'react';

export type Role = 'superAdmin' | 'vendor' | 'buyer';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  photoURL?: string;
  verified?: boolean; // Vendor verification
  city?: string;
  phoneNumber?: string;
  userType?: "farmer" | "customer" | "admin";
  isActive?: boolean;
  createdAt?: number;
}

export type ProductType = 'retail' | 'wholesale' | 'auction';
export type ProductApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface BulkTier {
  qty: number;
  price: number;
}

export interface Bid {
  id: string;
  bidderId: string;
  bidderName: string;
  amount: number;
  timestamp: number;
}

export interface Product {
  id: string;
  vendorId: string;
  vendorName: string;
  title: string;
  description: string;
  category: string;
  images: string[];
  productType: ProductType;
  
  // Retail/Wholesale fields
  basePrice?: number;
  stock?: number;
  minOrderQty?: number;
  bulkTiers?: BulkTier[];

  // Auction fields
  isAuction?: boolean;
  startingPrice?: number;
  currentHighestBid?: number;
  bidIncrement?: number;
  auctionStartTime?: number;
  auctionEndTime?: number;
  buyNowPrice?: number; // Added for Buy Now functionality
  bids?: Bid[];
  auctionQuantity?: number;
  auctionStatus?: 'live' | 'ended' | 'cancelled';
  winnerBidderId?: string;
  winnerBidderName?: string;
  winnerOrderId?: string;
  isActive?: boolean;
  approvalStatus?: ProductApprovalStatus;
  isApproved?: boolean;
  createdAt?: number;
  updatedAt?: number;
  submittedAt?: number;
  approvedAt?: number;
  rejectedAt?: number;
  approvedBy?: string;
  rejectionReason?: string;
  
  rating?: number;
  reviewsCount?: number;
}

export interface Order {
  id: string;
  customerId: string;
  vendorId: string;
  items: {
    productId: string;
    productName: string;
    qty: number;
    priceAtPurchase: number;
  }[];
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  date: string;
}

export interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  isPositive?: boolean;
  icon: React.ReactNode;
  color: string;
}
