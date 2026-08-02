import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from "next/link";
import { Search, Filter, Gavel, Tag, Star, Package, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';
import { Product, ProductStatus } from '../../types';
import { useWishlist } from '../../context/WishlistContext';
import { SkeletonTiles } from '../../components/Skeleton';
import {
  AuctionState,
  PaginatedProducts,
  ProductFilterOptions,
  ProductQuery,
  ProductSort,
  productApi,
} from '../../services/productApi';

const SEARCH_DEBOUNCE_MS = 400;
const SECTION_PAGE_SIZE = 8;
const FEATURED_COUNT = 4;

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price (low to high)' },
  { value: 'price_desc', label: 'Price (high to low)' },
  { value: 'title_asc', label: 'Name (A–Z)' },
  { value: 'title_desc', label: 'Name (Z–A)' },
];

const CONTROL_CLASS =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';
const LABEL_CLASS = 'mb-1 block text-sm font-medium text-gray-700';

interface Filters {
  category: string;
  vendorId: string;
  availability: 'all' | Extract<ProductStatus, 'active' | 'out_of_stock'>;
  auctionState: 'all' | Extract<AuctionState, 'active' | 'ended'>;
  minPrice: string;
  maxPrice: string;
}

const EMPTY_FILTERS: Filters = {
  category: 'all',
  vendorId: 'all',
  availability: 'all',
  auctionState: 'all',
  minPrice: '',
  maxPrice: '',
};

const ProductCard: React.FC<{ product: Product }> = React.memo(({ product }) => {
  const { addToWishlist, removeFromWishlist, isWishlisted } = useWishlist();
  const wishlisted = isWishlisted(product.id);
  return (
  <Link href={`/buyer/product/${product.id}`} className="group">
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
      <div className="relative h-48 overflow-hidden bg-gray-100">
        <img
          src={product.images[0]}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (wishlisted) {
                removeFromWishlist(product.id);
                return;
              }
              addToWishlist(product);
            }}
            className={`px-2 py-1 rounded-md text-xs font-bold shadow-sm ${wishlisted ? 'bg-pink-100 text-pink-700' : 'bg-white/90 text-gray-700'}`}
          >
            {wishlisted ? 'Wishlisted' : 'Wishlist'}
          </button>
          {product.productType === 'auction' ? (
            <span className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
              <Gavel className="w-3 h-3" /> Live Auction
            </span>
          ) : product.productType === 'wholesale' ? (
              <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
              <Tag className="w-3 h-3" /> Wholesale
            </span>
          ) : null}
          {product.status === 'out_of_stock' && (
            <span className="bg-gray-900 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">
              Out of Stock
            </span>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
          <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide truncate pr-2">{product.category}</p>
          <div className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" /> {product.rating}
          </div>
        </div>

        <h3 className="font-bold text-gray-900 mb-1 line-clamp-2 group-hover:text-emerald-700 transition-colors">
          {product.title}
        </h3>
        <p className="text-sm text-gray-500 mb-4">{product.vendorName}</p>

        <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500">
              {product.isAuction ? 'Current Bid' : product.productType === 'wholesale' ? 'Bulk from' : 'Price'}
            </p>
            <p className="font-bold text-lg text-gray-900">
              {product.isAuction
                ? formatCurrency(product.currentHighestBid || 0)
                : formatCurrency(product.basePrice || 0)
              }
            </p>
          </div>
          <button className="px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg group-hover:bg-emerald-600 transition-colors">
            View
          </button>
        </div>
      </div>
    </div>
  </Link>
  );
});
ProductCard.displayName = 'ProductCard';

/**
 * One paginated marketplace section. Each section runs its own query so that
 * All Products, Live Auctions and Wholesale page independently, while sharing
 * the search box and filters above them.
 */
const useProductSection = (query: ProductQuery) => {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedProducts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  // Serialised so a new object with identical contents doesn't refetch.
  const queryKey = JSON.stringify(query);

  // A changed search or filter starts the section over at page 1.
  useEffect(() => {
    setPage(1);
  }, [queryKey]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);

    productApi
      .listProductsPage({ ...JSON.parse(queryKey), page, pageSize: SECTION_PAGE_SIZE })
      .then((response) => {
        if (requestId !== requestIdRef.current) return;
        setResult(response);
        setError(null);
        if (response.page !== page) setPage(response.page);
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        setResult(null);
        setError(err instanceof Error ? err.message : 'Failed to load products.');
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [queryKey, page]);

  return { result, loading, error, page, setPage };
};

const Pagination: React.FC<{
  page: number;
  totalPages: number;
  total: number;
  loading: boolean;
  onChange: (page: number) => void;
  label: string;
}> = ({ page, totalPages, total, loading, onChange, label }) => {
  if (total === 0) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-gray-500">
        Page {page} of {totalPages} · {total} item{total === 1 ? '' : 's'}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(page - 1, 1))}
          disabled={page <= 1 || loading}
          aria-label={`Previous page of ${label}`}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <button
          type="button"
          onClick={() => onChange(Math.min(page + 1, totalPages))}
          disabled={page >= totalPages || loading}
          aria-label={`Next page of ${label}`}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  section: ReturnType<typeof useProductSection>;
  emptyMessage: string;
}> = ({ title, icon, badge, section, emptyMessage }) => {
  const { result, loading, error, page, setPage } = section;
  const products = result?.data ?? [];

  return (
    <section>
      <div className="flex items-center gap-2 mb-6">
        {icon}
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        {badge}
        {result && <span className="text-sm text-gray-500">({result.total})</span>}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading && !result && <SkeletonTiles count={4} label={`Loading ${title}`} />}

      {!error && result && products.length === 0 && (
        <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">{emptyMessage}</p>
      )}

      {products.length > 0 && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 ${loading ? 'opacity-60' : ''}`}>
          {products.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      )}

      {result && (
        <Pagination
          page={page}
          totalPages={result.totalPages}
          total={result.total}
          loading={loading}
          onChange={setPage}
          label={title}
        />
      )}
    </section>
  );
};

const Marketplace: React.FC = () => {
  const { ensureWishlist } = useWishlist();
  const [searchInput, setSearchInput] = useState('');

  // Needed so the wishlist hearts on each card show the right state — fetched
  // when the marketplace opens rather than at login.
  useEffect(() => {
    void ensureWishlist();
  }, [ensureWishlist]);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<ProductSort>('newest');
  const [options, setOptions] = useState<ProductFilterOptions>({ categories: [], vendors: [] });

  // Debounce typing so we don't fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    productApi
      .listFilterOptions()
      .then((response) => {
        if (active) setOptions(response);
      })
      .catch(() => {
        if (active) setOptions({ categories: [], vendors: [] });
      });
    return () => {
      active = false;
    };
  }, []);

  // Shared by every section, so search and filters apply across all of them.
  const sharedQuery = useMemo<ProductQuery>(
    () => ({
      search: search || undefined,
      category: filters.category === 'all' ? undefined : filters.category,
      vendorId: filters.vendorId === 'all' ? undefined : filters.vendorId,
      status: filters.availability === 'all' ? undefined : filters.availability,
      minPrice: filters.minPrice === '' ? undefined : Number(filters.minPrice),
      maxPrice: filters.maxPrice === '' ? undefined : Number(filters.maxPrice),
      sort,
    }),
    [filters, search, sort]
  );

  const auctionQuery = useMemo<ProductQuery>(
    () => ({
      ...sharedQuery,
      productType: 'auction',
      auctionState: filters.auctionState === 'all' ? undefined : filters.auctionState,
    }),
    [filters.auctionState, sharedQuery]
  );

  const allProducts = useProductSection(sharedQuery);
  const auctions = useProductSection(auctionQuery);
  const wholesale = useProductSection(useMemo(() => ({ ...sharedQuery, productType: 'wholesale' as const }), [sharedQuery]));

  // Featured is a fixed shelf, not a view of the search — it stays out of the
  // way once the buyer is actually looking for something.
  const [featured, setFeatured] = useState<Product[]>([]);
  useEffect(() => {
    let active = true;
    productApi
      .listProductsPage({ productType: 'retail', sort: 'newest', page: 1, pageSize: FEATURED_COUNT })
      .then((response) => {
        if (active) setFeatured(response.data);
      })
      .catch(() => {
        if (active) setFeatured([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const activeFilterCount = useMemo(
    () => (Object.keys(EMPTY_FILTERS) as (keyof Filters)[]).filter((key) => filters[key] !== EMPTY_FILTERS[key]).length,
    [filters]
  );
  const isSearching = Boolean(search) || activeFilterCount > 0;

  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setSearchInput('');
    setSearch('');
    setSort('newest');
  };

  return (
    <div className="space-y-12 pb-12">
      {/* Header & Search */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Marketplace</h1>
            <p className="text-gray-500 mt-2">Sourcing premium agricultural products from Pakistan&apos;s top farms.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex flex-col md:flex-row gap-4 p-4">
            <div className="relative flex-grow">
              <label htmlFor="marketplace-search" className="sr-only">Search products</label>
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                id="marketplace-search"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search for wheat, rice, tractors..."
                className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <div>
                <label htmlFor="marketplace-sort" className="sr-only">Sort products</label>
                <select
                  id="marketplace-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as ProductSort)}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg bg-white min-w-[170px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                aria-expanded={showFilters}
                className={`px-4 py-2.5 border rounded-lg hover:bg-gray-50 flex items-center gap-2 ${
                  showFilters || activeFilterCount > 0 ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-300'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filter</span>
                {activeFilterCount > 0 && (
                  <span className="ml-1 rounded-full bg-emerald-600 px-2 text-xs font-semibold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 gap-4 border-t border-gray-200 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="filter-category" className={LABEL_CLASS}>Category</label>
                <select
                  id="filter-category"
                  value={filters.category}
                  onChange={(e) => updateFilter('category', e.target.value)}
                  className={CONTROL_CLASS}
                >
                  <option value="all">All categories</option>
                  {options.categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="filter-vendor" className={LABEL_CLASS}>Vendor</label>
                <select
                  id="filter-vendor"
                  value={filters.vendorId}
                  onChange={(e) => updateFilter('vendorId', e.target.value)}
                  className={CONTROL_CLASS}
                >
                  <option value="all">All vendors</option>
                  {options.vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="filter-availability" className={LABEL_CLASS}>Availability</label>
                <select
                  id="filter-availability"
                  value={filters.availability}
                  onChange={(e) => updateFilter('availability', e.target.value as Filters['availability'])}
                  className={CONTROL_CLASS}
                >
                  <option value="all">Any</option>
                  <option value="active">In stock</option>
                  <option value="out_of_stock">Out of stock</option>
                </select>
              </div>
              <div>
                <label htmlFor="filter-auction-state" className={LABEL_CLASS}>Auction status</label>
                <select
                  id="filter-auction-state"
                  value={filters.auctionState}
                  onChange={(e) => updateFilter('auctionState', e.target.value as Filters['auctionState'])}
                  className={CONTROL_CLASS}
                >
                  <option value="all">Any</option>
                  <option value="active">Live</option>
                  <option value="ended">Ended</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">Applies to the auctions section.</p>
              </div>
              <div className="sm:col-span-2">
                <span className={LABEL_CLASS}>Price range (PKR)</span>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label htmlFor="filter-min-price" className="mb-1 block text-xs text-gray-500">Min</label>
                    <input
                      id="filter-min-price"
                      type="number"
                      min={0}
                      value={filters.minPrice}
                      onChange={(e) => updateFilter('minPrice', e.target.value)}
                      placeholder="0"
                      className={CONTROL_CLASS}
                    />
                  </div>
                  <span className="pb-3 text-gray-400">–</span>
                  <div className="flex-1">
                    <label htmlFor="filter-max-price" className="mb-1 block text-xs text-gray-500">Max</label>
                    <input
                      id="filter-max-price"
                      type="number"
                      min={0}
                      value={filters.maxPrice}
                      onChange={(e) => updateFilter('maxPrice', e.target.value)}
                      placeholder="Any"
                      className={CONTROL_CLASS}
                    />
                  </div>
                </div>
              </div>
              {isSearching && (
                <div className="flex items-end justify-end sm:col-span-2 lg:col-span-4">
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
                  >
                    Clear search &amp; filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Section
        title="All Products"
        icon={<Package className="w-6 h-6 text-emerald-600" />}
        section={allProducts}
        emptyMessage={isSearching ? 'No products match your search.' : 'No products are listed yet.'}
      />

      <Section
        title="Live Auctions"
        icon={<Gavel className="w-6 h-6 text-purple-600" />}
        badge={
          <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">LIVE</span>
        }
        section={auctions}
        emptyMessage={isSearching ? 'No auctions match your search.' : 'No auctions are running right now.'}
      />

      <Section
        title="Wholesale Deals (MOQ)"
        icon={<Tag className="w-6 h-6 text-blue-600" />}
        section={wholesale}
        emptyMessage={isSearching ? 'No wholesale deals match your search.' : 'No wholesale deals are listed yet.'}
      />

      {/* Featured is a curated shelf, so it is hidden while the buyer searches. */}
      {!isSearching && featured.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Star className="w-6 h-6 text-yellow-500" />
            <h2 className="text-2xl font-bold text-gray-900">Featured Products</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featured.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </section>
      )}
    </div>
  );
};

export default Marketplace;
