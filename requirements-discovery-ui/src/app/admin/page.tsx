"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  listUsers,
  updateUserRole,
  adminCreateUser,
  adminDeleteUser,
  adminToggleUserActive,
  getOrganization,
  updateOrganization,
  grantSessionAccess,
  revokeSessionAccess,
  getUserSessionAccess,
  listSessions,
} from "@/lib/api";
import Header from "@/components/layout/Header";
import {
  ShieldCheckIcon,
  UserIcon,
  PencilSquareIcon,
  EyeIcon,
  StarIcon,
  CheckIcon,
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  NoSymbolIcon,
  UserPlusIcon,
  BuildingOffice2Icon,
  MagnifyingGlassIcon,
  KeyIcon,
  FolderIcon,
  GlobeAltIcon,
  UsersIcon,
  Cog6ToothIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

/* ─── Types ──────────────────────────────────────────────────────────── */

interface AdminUser {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
  role: string;
  org_role: string | null;
  job_title: string | null;
  created_at: string;
}

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  industry: string | null;
  size: string | null;
  website: string | null;
  is_active: boolean;
  created_at: string;
}

interface SessionItem {
  id: string;
  user_type: string;
  status: string;
  created_at: string;
  document_filename?: string;
}

interface SessionAccessItem {
  session_id: string;
  session_name?: string;
  role: string;
  created_at: string;
}

/* ─── Constants ──────────────────────────────────────────────────────── */

const APP_ROLES = [
  { value: "admin", label: "Admin", icon: ShieldCheckIcon, color: "text-purple-600 bg-purple-50 border-purple-200" },
  { value: "editor", label: "Editor", icon: PencilSquareIcon, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "viewer", label: "Viewer", icon: EyeIcon, color: "text-neutral-600 bg-neutral-50 border-neutral-200" },
];

const ORG_ROLES = [
  { value: "owner", label: "Owner", icon: StarIcon, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { value: "admin", label: "Admin", icon: ShieldCheckIcon, color: "text-purple-600 bg-purple-50 border-purple-200" },
  { value: "member", label: "Member", icon: UserIcon, color: "text-blue-600 bg-blue-50 border-blue-200" },
];

function RoleBadge({ role, type = "app" }: { role: string; type?: "app" | "org" }) {
  const list = type === "org" ? ORG_ROLES : APP_ROLES;
  const config = list.find((r) => r.value === role) || list[list.length - 1];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

type ActiveTab = "employees" | "organization";

/* ─── Component ──────────────────────────────────────────────────────── */

export default function AdminPage() {
  const { user, isLoading: authLoading, isAuthenticated, isOrgAdmin } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>("employees");

  // Employees
  const [employees, setEmployees] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Organization
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [editOrg, setEditOrg] = useState(false);
  const [orgForm, setOrgForm] = useState({ name: "", industry: "", size: "", website: "" });

  // Shared
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // Add user form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "", username: "", password: "", role: "editor", org_role: "member", job_title: "",
  });

  // Role editing
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Session access
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userAccess, setUserAccess] = useState<Record<string, SessionAccessItem[]>>({});
  const [allSessions, setAllSessions] = useState<SessionItem[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [grantSessionId, setGrantSessionId] = useState("");
  const [grantRole, setGrantRole] = useState("viewer");

  /* ─── Guards ──────────────────────────────────────────── */

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && !isOrgAdmin) router.push("/");
  }, [authLoading, isAuthenticated, isOrgAdmin, router]);

  /* ─── Data Fetching ───────────────────────────────────── */

  const flash = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const fetchEmployees = useCallback(async () => {
    if (!isOrgAdmin) return;
    try {
      setIsLoadingUsers(true);
      const data = await listUsers(search || undefined, roleFilter || undefined);
      setEmployees(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to load employees.");
    } finally {
      setIsLoadingUsers(false);
    }
  }, [isOrgAdmin, search, roleFilter]);

  const fetchOrg = useCallback(async () => {
    if (!isOrgAdmin) return;
    try {
      const data = await getOrganization();
      setOrg(data);
      setOrgForm({ name: data.name, industry: data.industry || "", size: data.size || "", website: data.website || "" });
    } catch {
      // no org
    }
  }, [isOrgAdmin]);

  useEffect(() => {
    if (isAuthenticated && isOrgAdmin) {
      fetchEmployees();
      fetchOrg();
    }
  }, [isAuthenticated, isOrgAdmin, fetchEmployees, fetchOrg]);

  /* ─── Employee Actions ────────────────────────────────── */

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.username || !newUser.password) {
      setError("Email, username, and password are required"); return;
    }
    try {
      setSaving(true);
      await adminCreateUser({
        email: newUser.email,
        username: newUser.username,
        password: newUser.password,
        role: newUser.role,
        org_role: newUser.org_role,
        job_title: newUser.job_title || undefined,
      });
      setShowAddForm(false);
      setNewUser({ email: "", username: "", password: "", role: "editor", org_role: "member", job_title: "" });
      flash("Employee added successfully");
      await fetchEmployees();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to create employee.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRole = async (userId: string) => {
    try {
      setSaving(true);
      const updated = await updateUserRole(userId, selectedRole);
      setEmployees((prev) => prev.map((u) => (u.id === userId ? { ...u, role: updated.role } : u)));
      setEditingUserId(null);
      flash("Role updated");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to update role.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      setSaving(true);
      await adminDeleteUser(userId);
      setEmployees((prev) => prev.filter((u) => u.id !== userId));
      setConfirmDeleteId(null);
      flash("Employee removed");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to remove employee.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (userId: string) => {
    try {
      const updated = await adminToggleUserActive(userId);
      setEmployees((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: updated.is_active } : u)));
      flash(`Employee ${updated.is_active ? "activated" : "deactivated"}`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to toggle status.");
    }
  };

  /* ─── Session Access ──────────────────────────────────── */

  const toggleExpandUser = async (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(userId);
    if (!sessionsLoaded) {
      try {
        const data = await listSessions();
        setAllSessions(data.sessions || data || []);
        setSessionsLoaded(true);
      } catch { /* ignore */ }
    }
    if (!userAccess[userId]) {
      try {
        const data = await getUserSessionAccess(userId);
        setUserAccess((prev) => ({ ...prev, [userId]: Array.isArray(data) ? data : data?.sessions || [] }));
      } catch { /* ignore */ }
    }
  };

  const handleGrantAccess = async (userId: string) => {
    if (!grantSessionId) return;
    try {
      setSaving(true);
      await grantSessionAccess(userId, [grantSessionId], grantRole);
      const data = await getUserSessionAccess(userId);
      setUserAccess((prev) => ({ ...prev, [userId]: Array.isArray(data) ? data : data?.sessions || [] }));
      setGrantSessionId("");
      flash("Session access granted");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to grant access.");
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeAccess = async (userId: string, sessionId: string) => {
    try {
      await revokeSessionAccess(userId, sessionId);
      setUserAccess((prev) => ({
        ...prev,
        [userId]: (prev[userId] || []).filter((a) => a.session_id !== sessionId),
      }));
      flash("Access revoked");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to revoke access.");
    }
  };

  /* ─── Org Actions ─────────────────────────────────────── */

  const handleUpdateOrg = async () => {
    try {
      setSaving(true);
      const updated = await updateOrganization(orgForm);
      setOrg(updated);
      setEditOrg(false);
      flash("Organization updated");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to update organization.");
    } finally {
      setSaving(false);
    }
  };

  /* ─── Render guard ────────────────────────────────────── */

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!isOrgAdmin) return null;

  const isOwner = user?.org_role === "owner";

  /* ─── UI ──────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {/* Page Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
              <BuildingOffice2Icon className="w-7 h-7 text-primary-600" />
              {org?.name || "Enterprise"} Admin
            </h1>
            <p className="text-neutral-500 mt-1 text-sm">
              Manage your organization, employees, and session access
            </p>
          </div>
          {org && (
            <span className="text-xs text-neutral-400 bg-neutral-100 px-2.5 py-1 rounded-full">
              {org.slug}
            </span>
          )}
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <UsersIcon className="w-4 h-4 text-neutral-400" />
              <span className="text-xs text-neutral-500">Total Employees</span>
            </div>
            <span className="text-2xl font-bold text-neutral-900">{employees.length}</span>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckIcon className="w-4 h-4 text-green-500" />
              <span className="text-xs text-neutral-500">Active</span>
            </div>
            <span className="text-2xl font-bold text-green-700">
              {employees.filter((e) => e.is_active).length}
            </span>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheckIcon className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-neutral-500">Admins</span>
            </div>
            <span className="text-2xl font-bold text-purple-700">
              {employees.filter((e) => e.org_role === "owner" || e.org_role === "admin").length}
            </span>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <EyeIcon className="w-4 h-4 text-neutral-400" />
              <span className="text-xs text-neutral-500">Viewers</span>
            </div>
            <span className="text-2xl font-bold text-neutral-700">
              {employees.filter((e) => e.role === "viewer").length}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-neutral-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("employees")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "employees"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            <UsersIcon className="w-4 h-4" />
            Employees
          </button>
          <button
            onClick={() => setActiveTab("organization")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "organization"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            <Cog6ToothIcon className="w-4 h-4" />
            Organization
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="ml-2 text-red-500 hover:text-red-700">
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 animate-fade-in">
            <CheckIcon className="w-4 h-4 inline mr-1" />
            {successMsg}
          </div>
        )}

        {/* ═══ EMPLOYEES TAB ══════════════════════════════════════ */}
        {activeTab === "employees" && (
          <div className="space-y-4">
            {/* Search & Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search employees..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="text-sm border border-neutral-200 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="">All roles</option>
                {APP_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <button
                onClick={() => fetchEmployees()}
                className="text-sm px-4 py-2 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors"
              >
                Search
              </button>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors shadow-sm"
                >
                  <UserPlusIcon className="w-4 h-4" />
                  Add Employee
                </button>
              )}
            </div>

            {/* Add Employee Form */}
            {showAddForm && (
              <div className="bg-white rounded-xl border border-primary-200 p-5 shadow-sm">
                <h3 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2 text-sm">
                  <UserPlusIcon className="w-5 h-5 text-primary-600" />
                  Add New Employee
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">Email *</label>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="employee@company.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">Username *</label>
                    <input
                      type="text"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="johndoe"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">Password *</label>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">Job Title</label>
                    <input
                      type="text"
                      value={newUser.job_title}
                      onChange={(e) => setNewUser({ ...newUser, job_title: e.target.value })}
                      className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="Software Engineer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">App Role</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                      {APP_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">Org Role</label>
                    <select
                      value={newUser.org_role}
                      onChange={(e) => setNewUser({ ...newUser, org_role: e.target.value })}
                      className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={handleCreateUser}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add Employee
                  </button>
                  <button
                    onClick={() => { setShowAddForm(false); setNewUser({ email: "", username: "", password: "", role: "editor", org_role: "member", job_title: "" }); }}
                    className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Employee List */}
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
                <h2 className="font-semibold text-neutral-900 text-sm">
                  Employees <span className="text-neutral-400 font-normal">({employees.length})</span>
                </h2>
              </div>

              {isLoadingUsers ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
                </div>
              ) : employees.length === 0 ? (
                <div className="text-center py-16 text-neutral-400 text-sm">No employees found</div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {employees.map((emp) => {
                    const isSelf = emp.id === user?.id;
                    const isExpanded = expandedUserId === emp.id;
                    const access = userAccess[emp.id] || [];

                    return (
                      <div key={emp.id} className={`${!emp.is_active ? "opacity-60" : ""}`}>
                        {/* Employee Row */}
                        <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-50/50 transition-colors">
                          {/* Avatar */}
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${emp.is_active ? "bg-gradient-to-br from-primary-400 to-primary-600" : "bg-neutral-300"}`}>
                            <span className="text-white text-sm font-semibold">
                              {emp.username?.charAt(0).toUpperCase()}
                            </span>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-neutral-900 truncate">
                                {emp.username}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-primary-100 text-primary-600 rounded-full font-medium">YOU</span>
                              )}
                              {emp.job_title && (
                                <span className="text-xs text-neutral-400 hidden sm:inline">
                                  — {emp.job_title}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-neutral-500 truncate">{emp.email}</div>
                          </div>

                          {/* Badges */}
                          <div className="hidden sm:flex items-center gap-2">
                            {editingUserId === emp.id ? (
                              <div className="flex items-center gap-1">
                                <select
                                  value={selectedRole}
                                  onChange={(e) => setSelectedRole(e.target.value)}
                                  className="text-xs border border-neutral-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-primary-500 outline-none"
                                >
                                  {APP_ROLES.map((r) => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleSaveRole(emp.id)}
                                  disabled={saving || selectedRole === emp.role}
                                  className="p-1 text-primary-600 hover:bg-primary-50 rounded disabled:opacity-50"
                                >
                                  <CheckIcon className="w-4 h-4" />
                                </button>
                                <button onClick={() => setEditingUserId(null)} className="p-1 text-neutral-400 hover:bg-neutral-100 rounded">
                                  <XMarkIcon className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <RoleBadge role={emp.role} type="app" />
                                {emp.org_role && <RoleBadge role={emp.org_role} type="org" />}
                              </>
                            )}
                          </div>

                          {/* Status */}
                          <span className={`hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${emp.is_active ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${emp.is_active ? "bg-green-500" : "bg-red-400"}`} />
                            {emp.is_active ? "Active" : "Disabled"}
                          </span>

                          {/* Actions */}
                          {!isSelf && (
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={() => toggleExpandUser(emp.id)}
                                title="Manage session access"
                                className="p-1.5 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                              >
                                <KeyIcon className="w-4 h-4" />
                              </button>
                              {isOwner && editingUserId !== emp.id && (
                                <button
                                  onClick={() => { setEditingUserId(emp.id); setSelectedRole(emp.role); }}
                                  title="Change role"
                                  className="p-1.5 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                >
                                  <PencilSquareIcon className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleToggleActive(emp.id)}
                                title={emp.is_active ? "Disable" : "Enable"}
                                className={`p-1.5 rounded-lg transition-colors ${emp.is_active ? "text-neutral-400 hover:text-amber-600 hover:bg-amber-50" : "text-amber-500 hover:text-green-600 hover:bg-green-50"}`}
                              >
                                <NoSymbolIcon className="w-4 h-4" />
                              </button>
                              {isOwner && emp.org_role !== "owner" && (
                                confirmDeleteId === emp.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleDeleteUser(emp.id)}
                                      disabled={saving}
                                      className="px-2 py-1 text-[11px] font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                                    >
                                      Confirm
                                    </button>
                                    <button onClick={() => setConfirmDeleteId(null)} className="p-1 text-neutral-400 hover:bg-neutral-100 rounded">
                                      <XMarkIcon className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDeleteId(emp.id)}
                                    title="Remove employee"
                                    className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                )
                              )}
                              <button
                                onClick={() => toggleExpandUser(emp.id)}
                                className="p-1.5 text-neutral-300 hover:text-neutral-500 rounded-lg transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronDownIcon className="w-4 h-4" />
                                ) : (
                                  <ChevronRightIcon className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Expanded: Session Access Panel */}
                        {isExpanded && !isSelf && (
                          <div className="bg-neutral-50 border-t border-neutral-100 px-5 py-4">
                            <div className="max-w-2xl ml-13">
                              <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <FolderIcon className="w-3.5 h-3.5" />
                                Session Access for {emp.username}
                              </h4>

                              {/* Grant Access */}
                              <div className="flex items-center gap-2 mb-3">
                                <select
                                  value={grantSessionId}
                                  onChange={(e) => setGrantSessionId(e.target.value)}
                                  className="flex-1 text-xs border border-neutral-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                                >
                                  <option value="">Select a session to grant...</option>
                                  {allSessions
                                    .filter((s) => !access.find((a) => a.session_id === s.id))
                                    .map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.document_filename || 'Untitled'} — {new Date(s.created_at).toLocaleDateString()} ({s.status})
                                      </option>
                                    ))}
                                </select>
                                <select
                                  value={grantRole}
                                  onChange={(e) => setGrantRole(e.target.value)}
                                  className="text-xs border border-neutral-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                                >
                                  <option value="viewer">Viewer</option>
                                  <option value="editor">Editor</option>
                                </select>
                                <button
                                  onClick={() => handleGrantAccess(emp.id)}
                                  disabled={!grantSessionId || saving}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 transition-colors"
                                >
                                  <PlusIcon className="w-3.5 h-3.5" />
                                  Grant
                                </button>
                              </div>

                              {/* Current Access */}
                              {access.length === 0 ? (
                                <p className="text-xs text-neutral-400 italic">No sessions assigned yet</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {access.map((a) => (
                                    <div
                                      key={a.session_id}
                                      className="flex items-center justify-between bg-white border border-neutral-200 rounded-lg px-3 py-2"
                                    >
                                      <div className="flex items-center gap-2">
                                        <FolderIcon className="w-3.5 h-3.5 text-neutral-400" />
                                        <span className="text-xs text-neutral-700">
                                          {a.session_name || a.session_id.slice(0, 8) + '...'}
                                        </span>
                                        <RoleBadge role={a.role} type="app" />
                                      </div>
                                      <button
                                        onClick={() => handleRevokeAccess(emp.id, a.session_id)}
                                        className="p-1 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                        title="Revoke access"
                                      >
                                        <XMarkIcon className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ ORGANIZATION TAB ═══════════════════════════════════ */}
        {activeTab === "organization" && org && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
                <h2 className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
                  <BuildingOffice2Icon className="w-5 h-5 text-primary-500" />
                  Organization Profile
                </h2>
                {isOwner && !editOrg && (
                  <button
                    onClick={() => setEditOrg(true)}
                    className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    <PencilSquareIcon className="w-3.5 h-3.5" />
                    Edit
                  </button>
                )}
              </div>

              {editOrg ? (
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">Organization Name</label>
                      <input
                        type="text"
                        value={orgForm.name}
                        onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                        className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">Industry</label>
                      <input
                        type="text"
                        value={orgForm.industry}
                        onChange={(e) => setOrgForm({ ...orgForm, industry: e.target.value })}
                        className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">Company Size</label>
                      <input
                        type="text"
                        value={orgForm.size}
                        onChange={(e) => setOrgForm({ ...orgForm, size: e.target.value })}
                        className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">Website</label>
                      <input
                        type="url"
                        value={orgForm.website}
                        onChange={(e) => setOrgForm({ ...orgForm, website: e.target.value })}
                        className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdateOrg}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 transition-colors"
                    >
                      <CheckIcon className="w-4 h-4" />
                      Save Changes
                    </button>
                    <button
                      onClick={() => { setEditOrg(false); setOrgForm({ name: org.name, industry: org.industry || "", size: org.size || "", website: org.website || "" }); }}
                      className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-5">
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                    <div>
                      <dt className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Name</dt>
                      <dd className="text-sm text-neutral-900 mt-0.5 font-medium">{org.name}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Slug</dt>
                      <dd className="text-sm text-neutral-600 mt-0.5 font-mono">{org.slug}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Industry</dt>
                      <dd className="text-sm text-neutral-700 mt-0.5">{org.industry || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Company Size</dt>
                      <dd className="text-sm text-neutral-700 mt-0.5">{org.size || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Website</dt>
                      <dd className="text-sm mt-0.5">
                        {org.website ? (
                          <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline flex items-center gap-1">
                            <GlobeAltIcon className="w-3.5 h-3.5" />
                            {org.website}
                          </a>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Created</dt>
                      <dd className="text-sm text-neutral-700 mt-0.5">
                        {new Date(org.created_at).toLocaleDateString("en-US", {
                          year: "numeric", month: "long", day: "numeric",
                        })}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
