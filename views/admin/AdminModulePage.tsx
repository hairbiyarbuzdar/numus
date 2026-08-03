import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SkeletonTableRows } from "../../components/Skeleton";
import { buildPageList } from "../../utils/helpers";

/** Supplied by modules that page server-side; omitted by static tables. */
export interface AdminModulePagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

interface AdminModulePageProps {
  title: string;
  subtitle: string;
  columns: string[];
  rows: string[][];
  /** Set while the module is still fetching, to swap the rows for a skeleton. */
  loading?: boolean;
  emptyMessage?: string;
  pagination?: AdminModulePagination;
}

const DEFAULT_PAGE_SIZES = [10, 25, 50];

const AdminModulePage: React.FC<AdminModulePageProps> = ({
  title,
  subtitle,
  columns,
  rows,
  loading = false,
  emptyMessage = "Nothing to show yet.",
  pagination,
}) => {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-cyan-900 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-cyan-100">{subtitle}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-4 py-3 text-left font-semibold text-slate-700">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonTableRows rows={5} columns={columns.length} label={`Loading ${title}`} />}
              {!loading && rows.map((row, rowIndex) => (
                <tr key={`${title}-${rowIndex}`} className="border-t border-slate-100">
                  {row.map((value, valueIndex) => (
                    <td key={`${title}-${rowIndex}-${valueIndex}`} className="px-4 py-3 text-slate-600">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-500">
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pagination && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <span>
                {pagination.total === 0
                  ? "No results"
                  : `Showing ${(pagination.page - 1) * pagination.pageSize + 1}–${Math.min(
                      pagination.page * pagination.pageSize,
                      pagination.total
                    )} of ${pagination.total}`}
              </span>
              <label htmlFor={`${title}-page-size`} className="flex items-center gap-2">
                <span className="font-medium text-slate-700">Rows per page</span>
                <select
                  id={`${title}-page-size`}
                  value={pagination.pageSize}
                  onChange={(e) => pagination.onPageSizeChange(Number(e.target.value))}
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1"
                >
                  {(pagination.pageSizeOptions ?? DEFAULT_PAGE_SIZES).map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => pagination.onPageChange(Math.max(pagination.page - 1, 1))}
                disabled={pagination.page <= 1 || loading}
                aria-label="Previous page"
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              {buildPageList(pagination.page, pagination.totalPages).map((entry, idx) =>
                entry === "gap" ? (
                  <span key={`gap-${idx}`} className="px-2 text-sm text-gray-400">…</span>
                ) : (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => pagination.onPageChange(entry)}
                    disabled={loading}
                    aria-current={entry === pagination.page ? "page" : undefined}
                    className={`min-w-[36px] rounded-lg border px-2 py-1.5 text-sm ${
                      entry === pagination.page
                        ? "border-cyan-600 bg-cyan-600 text-white"
                        : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {entry}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => pagination.onPageChange(Math.min(pagination.page + 1, pagination.totalPages))}
                disabled={pagination.page >= pagination.totalPages || loading}
                aria-label="Next page"
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminModulePage;
