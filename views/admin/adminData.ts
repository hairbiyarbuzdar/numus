import { Product } from "../../types";
import { formatCurrency, getTimeRemaining } from "../../utils/helpers";

export const getAdminStats = (products: Product[]) => {
  const auctionProducts = products.filter((product) => product.isAuction || product.productType === "auction");
  const listingProducts = products.filter(
    (product) => product.productType === "retail" || product.productType === "wholesale" || product.productType === "auction"
  );
  const endingTodayCount = auctionProducts.filter((auction) => {
    if (!auction.auctionEndTime) return false;
    const timeLeft = auction.auctionEndTime - Date.now();
    return timeLeft > 0 && timeLeft <= 24 * 60 * 60 * 1000;
  }).length;

  return [
    { title: "Orders", value: "1,284", detail: "62 pending approvals" },
    { title: "Auctions", value: auctionProducts.length.toString(), detail: `${endingTodayCount} ending today` },
    { title: "Approved Listings", value: listingProducts.length.toString(), detail: "Auto-synced from farmer listings" },
    { title: "Payments", value: "$284,120", detail: "$31,400 awaiting settlement" },
  ];
};

export const recentOrders = [
  { id: "ORD-1042", customer: "Green Valley Co-op", farmer: "Aman Farms", total: "$1,240", status: "Pending" },
  { id: "ORD-1043", customer: "City Fresh Market", farmer: "Rana Organics", total: "$860", status: "Processing" },
  { id: "ORD-1044", customer: "Agro Mart", farmer: "FarmHub Supply", total: "$3,120", status: "Delivered" },
  { id: "ORD-1045", customer: "Harvest Depot", farmer: "Sunrise Agri", total: "$2,010", status: "Pending" },
];

export const getAuctions = (products: Product[]) =>
  products
    .filter((product) => product.isAuction || product.productType === "auction")
    .map((auction) => {
    const isClosed = auction.auctionStatus === "ended" || !auction.auctionEndTime || auction.auctionEndTime <= Date.now();
    const timeLeft = auction.auctionEndTime ? getTimeRemaining(auction.auctionEndTime) : null;
    const sortedBids = [...(auction.bids || [])].sort((a, b) => b.timestamp - a.timestamp);
    const activity = sortedBids.length
      ? sortedBids
          .slice(0, 2)
          .map((bid) => `${bid.bidderName}: ${formatCurrency(bid.amount)}`)
          .join(" | ")
      : "No bids yet";

    return {
      lot: auction.title,
      farmer: auction.vendorName,
      highestBid: formatCurrency(auction.currentHighestBid || auction.startingPrice || 0),
      bidCount: String(auction.bids?.length || 0),
      bidActivity: activity,
      endsIn: isClosed || !timeLeft ? "Closed" : `${timeLeft.days}d ${timeLeft.hours}h ${timeLeft.minutes}m`,
      status: isClosed ? "Closed" : "Live",
    };
  });

export const getListings = (products: Product[]) =>
  products
    .filter(
      (product) => product.productType === "retail" || product.productType === "wholesale" || product.productType === "auction"
    )
    .map((listing) => ({
    title: listing.title,
    farmer: listing.vendorName,
    type: listing.productType.toUpperCase(),
    category: listing.category,
    moq: String(listing.minOrderQty || 1),
    status: listing.productType === "auction" ? "Live Auction" : listing.productType === "wholesale" ? "MOQ Active" : "Approved",
  }));

export const farmers = [
  { name: "Aman Farms", location: "Punjab", activeListings: 22, verification: "Verified" },
  { name: "Rana Organics", location: "Sindh", activeListings: 18, verification: "Verified" },
  { name: "Sunrise Agri", location: "KPK", activeListings: 11, verification: "Pending" },
];

export const customers = [
  { name: "City Fresh Market", segment: "Retail", orders: 74, lastOrder: "2 hours ago" },
  { name: "Green Valley Co-op", segment: "Wholesale", orders: 41, lastOrder: "5 hours ago" },
  { name: "Harvest Depot", segment: "Distributor", orders: 26, lastOrder: "1 day ago" },
];

export const payments = [
  { ref: "PAY-8009", orderId: "ORD-1042", payee: "Aman Farms", amount: "$1,240", status: "Pending" },
  { ref: "PAY-8010", orderId: "ORD-1043", payee: "Rana Organics", amount: "$860", status: "Settled" },
  { ref: "PAY-8011", orderId: "ORD-1044", payee: "FarmHub Supply", amount: "$3,120", status: "Settled" },
];
