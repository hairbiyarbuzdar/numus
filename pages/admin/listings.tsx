import { useEffect, useRef, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import AdminModulePage from "../../views/admin/AdminModulePage";
import { PaginatedProducts, productApi } from "../../services/productApi";
import { Product } from "../../types";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const listingType = (product: Product) => product.productType.toUpperCase();

const listingStatus = (product: Product) => {
  if (product.productType === "auction") return "Live Auction";
  if (product.productType === "wholesale") return "MOQ Active";
  return "Approved";
};

export default function AdminListingsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [result, setResult] = useState<PaginatedProducts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  // Only approved listings, one page at a time — this used to pull the whole
  // catalogue into the browser and render every row.
  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);

    productApi
      .listProductsPage({ approvalStatus: "approved", page, pageSize, sort: "newest" })
      .then((response) => {
        if (requestId !== requestIdRef.current) return;
        setResult(response);
        setError(null);
        if (response.page !== page) setPage(response.page);
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        setResult(null);
        setError(err instanceof Error ? err.message : "Failed to load approved listings.");
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [page, pageSize]);

  const listings = result?.data ?? [];

  return (
    <DashboardLayout requiredRoles={["superAdmin"]}>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}
      <AdminModulePage
        title="Approved Product Listings"
        subtitle="Auto-sync farmer auctions, product listings, and MOQ wholesale entries."
        columns={["Listing", "Farmer", "Type", "Category", "MOQ", "Status"]}
        rows={listings.map((listing) => [
          listing.title,
          listing.vendorName,
          listingType(listing),
          listing.category,
          String(listing.minOrderQty || 1),
          listingStatus(listing),
        ])}
        loading={loading && !result}
        emptyMessage="No approved listings yet."
        pagination={
          result
            ? {
                page: result.page,
                pageSize: result.pageSize,
                total: result.total,
                totalPages: result.totalPages,
                pageSizeOptions: PAGE_SIZE_OPTIONS,
                onPageChange: setPage,
                onPageSizeChange: (size) => {
                  setPageSize(size);
                  setPage(1);
                },
              }
            : undefined
        }
      />
    </DashboardLayout>
  );
}
