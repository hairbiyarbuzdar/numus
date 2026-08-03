import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  Loader2,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import ConfirmModal from "../../components/ConfirmModal";
import { SkeletonTableRows } from "../../components/Skeleton";
import { useProducts } from "../../context/ProductContext";
import { User } from "../../types";
import { buildPageList, formatDateTime } from "../../utils/helpers";
import { PaginatedUsers, UserQuery, UserSort, userApi } from "../../services/userApi";

interface AdminUsersManagerProps {
  defaultType?: "farmer" | "customer" | "all";
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const SEARCH_DEBOUNCE_MS = 400;

/** "All" means the two account types this screen manages — never staff. */
const ALL_MANAGED_TYPES = "farmer,customer";

const SORT_OPTIONS: { value: UserSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name_asc", label: "Name (A–Z)" },
  { value: "name_desc", label: "Name (Z–A)" },
];

const CONTROL_CLASS =
  "rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-cyan-500 focus:outline-none";

const userTypeLabel = (type: User["userType"]) => {
  if (type === "farmer") return "Farmer";
  if (type === "customer") return "Customer";
  return "Admin";
};

const AdminUsersManager: React.FC<AdminUsersManagerProps> = ({ defaultType = "all" }) => {
  const { setVendorListingsVisibility } = useProducts();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [userType, setUserType] = useState<"all" | "farmer" | "customer">(defaultType);
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState<UserSort>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  const [result, setResult] = useState<PaginatedUsers | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const actingRef = useRef<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editDraft, setEditDraft] = useState({ displayName: "", city: "", email: "" });
  const [saving, setSaving] = useState(false);

  // The page's own type wins when it is opened fresh (Manage Farmers vs Customers).
  useEffect(() => {
    setUserType(defaultType);
    setPage(1);
  }, [defaultType]);

  // Debounce typing so we don't fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const query = useMemo<UserQuery>(
    () => ({
      search: search || undefined,
      userType: userType === "all" ? ALL_MANAGED_TYPES : userType,
      isActive: status === "all" ? undefined : status === "active",
      sort,
      page,
      pageSize,
    }),
    [page, pageSize, search, sort, status, userType]
  );

  // Guards against a slow earlier request overwriting a newer result.
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);

    userApi
      .listUsersPage(query)
      .then((response) => {
        if (requestId !== requestIdRef.current) return;
        setResult(response);
        setListError(null);
        if (response.page !== page) setPage(response.page);
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        setResult(null);
        setListError(err instanceof Error ? err.message : "Failed to load users.");
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [query, page, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((prev) => prev + 1), []);

  const users = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const hasQuery = Boolean(search) || status !== "all" || userType !== defaultType;

  const clearAll = () => {
    setSearchInput("");
    setSearch("");
    setStatus("all");
    setUserType(defaultType);
    setSort("newest");
    setPage(1);
  };

  /** One request per click; the row's buttons stay disabled until it lands. */
  const runAction = async (userId: string, action: () => Promise<unknown>, failure: string) => {
    if (actingRef.current) return;
    actingRef.current = userId;
    setActingOn(userId);
    try {
      await action();
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : failure);
    } finally {
      actingRef.current = null;
      setActingOn(null);
    }
  };

  const toggleActive = (user: User) =>
    runAction(
      user.uid,
      async () => {
        const nextActive = !user.isActive;
        await userApi.setUserActive(user.uid, nextActive);
        // A farmer's listings follow their account: deactivating hides them.
        if (user.userType === "farmer") {
          await setVendorListingsVisibility(user.uid, nextActive);
        }
      },
      "Failed to update the account."
    );

  const heading = defaultType === "farmer" ? "Manage Farmers" : defaultType === "customer" ? "Manage Customers" : "Users Management";

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-cyan-900 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
        <p className="mt-2 text-sm text-cyan-100">Manage farmers and customers, control activation, and update account data.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <label htmlFor="users-search" className="sr-only">Search users</label>
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
            <input
              id="users-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Name, email, phone or city"
              className={`${CONTROL_CLASS} w-full pl-9 pr-9`}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label="Clear search"
                className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <select
            aria-label="Filter by account type"
            value={userType}
            onChange={(e) => {
              setUserType(e.target.value as "all" | "farmer" | "customer");
              setPage(1);
            }}
            className={CONTROL_CLASS}
          >
            <option value="all">All Users</option>
            <option value="farmer">Farmers</option>
            <option value="customer">Customers</option>
          </select>

          <select
            aria-label="Filter by account status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as "all" | "active" | "inactive");
              setPage(1);
            }}
            className={CONTROL_CLASS}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            aria-label="Sort users"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as UserSort);
              setPage(1);
            }}
            className={CONTROL_CLASS}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          {hasQuery && (
            <div className="lg:col-span-5 flex justify-end">
              <button type="button" onClick={clearAll} className="text-sm font-medium text-cyan-700 hover:text-cyan-800">
                Clear search &amp; filters
              </button>
            </div>
          )}
        </div>
      </section>

      {listError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {listError}
          <button onClick={refresh} className="ml-2 font-semibold underline">Retry</button>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative overflow-x-auto">
          {loading && result && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
            </div>
          )}
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">User</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">City</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Phone</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Role</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Registered</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && !result && <SkeletonTableRows rows={5} columns={7} label="Loading users" />}

              {users.map((user) => {
                const busy = actingOn === user.uid;
                return (
                  <tr key={user.uid} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 overflow-hidden rounded-full bg-emerald-100 text-emerald-700">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt={user.displayName} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <UserRound className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{user.displayName}</p>
                          <p className="text-xs text-slate-500">{user.email || user.uid}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{user.city || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{user.phoneNumber || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{userTypeLabel(user.userType)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(user.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditDraft({ displayName: user.displayName, city: user.city ?? "", email: user.email ?? "" });
                            setEditingUser(user);
                          }}
                          disabled={busy}
                          className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                          title="Edit user details"
                          aria-label={`Edit ${user.displayName}`}
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => void toggleActive(user)}
                          disabled={busy}
                          className={`rounded-md p-1.5 disabled:opacity-40 ${user.isActive ? "border border-amber-300 text-amber-700 hover:bg-amber-50" : "border border-emerald-300 text-emerald-700 hover:bg-emerald-50"}`}
                          title={
                            user.isActive
                              ? user.userType === "farmer"
                                ? "Deactivate account and hide their listings"
                                : "Deactivate account"
                              : user.userType === "farmer"
                              ? "Activate account and restore their listings"
                              : "Activate account"
                          }
                          aria-label={user.isActive ? `Deactivate ${user.displayName}` : `Activate ${user.displayName}`}
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : user.isActive ? (
                            <ShieldOff className="h-4 w-4" />
                          ) : (
                            <ShieldCheck className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(user)}
                          disabled={busy}
                          className="rounded-md border border-red-300 p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-40"
                          title="Delete user permanently"
                          aria-label={`Delete ${user.displayName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    {hasQuery ? (
                      <>
                        <p className="font-medium text-slate-700">No users match your search.</p>
                        <button type="button" onClick={clearAll} className="mt-2 text-sm font-medium text-cyan-700 hover:text-cyan-800">
                          Clear search &amp; filters
                        </button>
                      </>
                    ) : (
                      <p className="font-medium text-slate-700">No users yet.</p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>{total === 0 ? "No results" : `Showing ${rangeStart}–${rangeEnd} of ${total}`}</span>
            <label htmlFor="users-page-size" className="flex items-center gap-2">
              <span className="font-medium text-slate-700">Rows per page</span>
              <select
                id="users-page-size"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page <= 1 || loading}
              aria-label="Previous page"
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            {buildPageList(page, totalPages).map((entry, idx) =>
              entry === "gap" ? (
                <span key={`gap-${idx}`} className="px-2 text-sm text-gray-400">…</span>
              ) : (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setPage(entry)}
                  disabled={loading}
                  aria-current={entry === page ? "page" : undefined}
                  className={`min-w-[36px] rounded-lg border px-2 py-1.5 text-sm ${
                    entry === page ? "border-cyan-600 bg-cyan-600 text-white" : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {entry}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={page >= totalPages || loading}
              aria-label="Next page"
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete User"
        message={`Delete ${deleteTarget?.displayName || "this user"}? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          const target = deleteTarget;
          setDeleteTarget(null);
          void runAction(target.uid, () => userApi.deleteUser(target.uid), "Failed to delete the user.");
        }}
      />

      {editingUser && (
        <div className="fixed inset-0 z-[94]">
          <button className="absolute inset-0 bg-black/40" aria-label="Close" onClick={() => setEditingUser(null)} />
          <div className="absolute left-1/2 top-1/2 w-[92%] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Edit User Details</h3>
            <div className="mt-4 grid gap-3">
              <div>
                <label htmlFor="edit-user-name" className="mb-1 block text-sm font-medium text-gray-700">Full name</label>
                <input
                  id="edit-user-name"
                  value={editDraft.displayName}
                  onChange={(e) => setEditDraft((prev) => ({ ...prev, displayName: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="edit-user-city" className="mb-1 block text-sm font-medium text-gray-700">City</label>
                <input
                  id="edit-user-city"
                  value={editDraft.city}
                  onChange={(e) => setEditDraft((prev) => ({ ...prev, city: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="edit-user-email" className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                <input
                  id="edit-user-email"
                  type="email"
                  value={editDraft.email}
                  onChange={(e) => setEditDraft((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditingUser(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                disabled={saving}
                onClick={() => {
                  if (!editingUser || saving) return;
                  setSaving(true);
                  void userApi
                    .updateUser(editingUser.uid, editDraft)
                    .then(() => {
                      setEditingUser(null);
                      refresh();
                    })
                    .catch((err) => {
                      alert(err instanceof Error ? err.message : "Failed to update the user.");
                    })
                    .finally(() => setSaving(false));
                }}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersManager;
