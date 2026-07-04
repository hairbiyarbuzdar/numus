import React, { useMemo, useState } from "react";
import { Edit3, Search, ShieldCheck, ShieldOff, Trash2, UserRound } from "lucide-react";
import ConfirmModal from "../../components/ConfirmModal";
import { useUsers } from "../../context/UsersContext";
import { useProducts } from "../../context/ProductContext";
import { User } from "../../types";

interface AdminUsersManagerProps {
  defaultType?: "farmer" | "customer" | "all";
}

const userTypeLabel = (type: User["userType"]) => {
  if (type === "farmer") return "Farmer";
  if (type === "customer") return "Customer";
  return "Admin";
};

const AdminUsersManager: React.FC<AdminUsersManagerProps> = ({ defaultType = "all" }) => {
  const { users, setUserActive, deleteUser, updateUser } = useUsers();
  const { setVendorListingsVisibility } = useProducts();
  const [query, setQuery] = useState("");
  const [userType, setUserType] = useState<"all" | "farmer" | "customer">(defaultType);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editDraft, setEditDraft] = useState({ displayName: "", city: "", email: "" });

  const filtered = useMemo(() => {
    return users.filter((user) => {
      if (user.userType === "admin") return false;
      if (userType !== "all" && user.userType !== userType) return false;
      const haystack = `${user.displayName} ${user.phoneNumber} ${user.city} ${user.email}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
  }, [query, userType, users]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-cyan-900 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight">Users Management</h1>
        <p className="mt-2 text-sm text-cyan-100">Manage farmers and customers, control activation, and update account data.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, phone, city"
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <select
            value={userType}
            onChange={(e) => setUserType(e.target.value as "all" | "farmer" | "customer")}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Users</option>
            <option value="farmer">Farmers</option>
            <option value="customer">Customers</option>
          </select>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
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
            {filtered.map((user) => (
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
                      <p className="text-xs text-slate-500">{user.uid}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">{user.city}</td>
                <td className="px-4 py-3 text-slate-700">{user.phoneNumber}</td>
                <td className="px-4 py-3 text-slate-700">{userTypeLabel(user.userType)}</td>
                <td className="px-4 py-3 text-slate-700">{new Date(user.createdAt).toLocaleDateString()}</td>
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
                      className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50"
                      title="Edit user"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        const nextActive = !user.isActive;
                        void setUserActive(user.uid, nextActive);
                        if (user.userType === "farmer") {
                          void setVendorListingsVisibility(user.uid, nextActive).catch((err) => {
                            alert(err instanceof Error ? err.message : "Failed to update farmer listings.");
                          });
                        }
                      }}
                      className={`rounded-md p-1.5 ${user.isActive ? "border border-amber-300 text-amber-700 hover:bg-amber-50" : "border border-emerald-300 text-emerald-700 hover:bg-emerald-50"}`}
                      title={user.isActive ? "Deactivate user" : "Activate user"}
                    >
                      {user.isActive ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(user)}
                      className="rounded-md border border-red-300 p-1.5 text-red-600 hover:bg-red-50"
                      title="Delete user"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
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
          void deleteUser(deleteTarget.uid);
          setDeleteTarget(null);
        }}
      />

      {editingUser && (
        <div className="fixed inset-0 z-[94]">
          <button className="absolute inset-0 bg-black/40" onClick={() => setEditingUser(null)} />
          <div className="absolute left-1/2 top-1/2 w-[92%] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Edit User Details</h3>
            <div className="mt-4 grid gap-3">
              <input
                value={editDraft.displayName}
                onChange={(e) => setEditDraft((prev) => ({ ...prev, displayName: e.target.value }))}
                className="rounded-lg border border-gray-300 px-3 py-2"
                placeholder="Full name"
              />
              <input
                value={editDraft.city}
                onChange={(e) => setEditDraft((prev) => ({ ...prev, city: e.target.value }))}
                className="rounded-lg border border-gray-300 px-3 py-2"
                placeholder="City"
              />
              <input
                value={editDraft.email}
                onChange={(e) => setEditDraft((prev) => ({ ...prev, email: e.target.value }))}
                className="rounded-lg border border-gray-300 px-3 py-2"
                placeholder="Email"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditingUser(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!editingUser) return;
                  void updateUser(editingUser.uid, editDraft);
                  setEditingUser(null);
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white"
              >
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
