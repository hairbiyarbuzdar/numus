import React from 'react';

/**
 * Placeholder shapes shown while a module loads its own data. Each module
 * fetches on open (see the lazy contexts in context/ProductContext.tsx and
 * context/UsersContext.tsx), so these stand in for the real layout and keep the
 * page from jumping when the data lands.
 */
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded bg-gray-200 ${className}`} aria-hidden="true" />
);

/** Screen readers get a spoken status; the shapes themselves are decorative. */
const LoadingLabel: React.FC<{ label: string }> = ({ label }) => (
  <span className="sr-only" role="status" aria-live="polite">{label}</span>
);

interface TableRowsProps {
  rows?: number;
  columns: number;
  label?: string;
}

/** Renders inside a <tbody> — table markup can't hold a wrapper element. */
export const SkeletonTableRows: React.FC<TableRowsProps> = ({
  rows = 5,
  columns,
  label = 'Loading rows',
}) => (
  <>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <tr key={rowIndex} className="border-t border-gray-100">
        {Array.from({ length: columns }).map((_, columnIndex) => (
          <td key={columnIndex} className="px-4 py-4">
            {rowIndex === 0 && columnIndex === 0 && <LoadingLabel label={label} />}
            <Skeleton className={`h-4 ${columnIndex === 0 ? 'w-40' : 'w-20'}`} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

interface CardsProps {
  count?: number;
  className?: string;
  label?: string;
}

export const SkeletonCards: React.FC<CardsProps> = ({
  count = 4,
  className = 'grid grid-cols-1 gap-6 lg:grid-cols-2',
  label = 'Loading',
}) => (
  <div className={className}>
    <LoadingLabel label={label} />
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-4">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      </div>
    ))}
  </div>
);

/** Product-grid tile: image block over two text lines. */
export const SkeletonTiles: React.FC<CardsProps> = ({
  count = 8,
  className = 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  label = 'Loading products',
}) => (
  <div className={className}>
    <LoadingLabel label={label} />
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <Skeleton className="h-44 w-full rounded-none" />
        <div className="space-y-2 p-4">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-5 w-1/3" />
        </div>
      </div>
    ))}
  </div>
);

export const SkeletonStats: React.FC<CardsProps> = ({
  count = 4,
  className = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4',
  label = 'Loading statistics',
}) => (
  <div className={className}>
    <LoadingLabel label={label} />
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-7 w-20" />
      </div>
    ))}
  </div>
);

/** Generic stacked lines, for list/detail panels. */
export const SkeletonLines: React.FC<{ lines?: number; className?: string; label?: string }> = ({
  lines = 3,
  className = 'space-y-3',
  label = 'Loading',
}) => (
  <div className={className}>
    <LoadingLabel label={label} />
    {Array.from({ length: lines }).map((_, index) => (
      <Skeleton key={index} className={`h-4 ${index === lines - 1 ? 'w-2/3' : 'w-full'}`} />
    ))}
  </div>
);
