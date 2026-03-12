import { apiFetch } from "./client";

export interface AdminStats {
  totalTenants: number;
  activeTenants: number;
  totalPsychologists: number;
  pendingLicenses: number;
  freeTenants: number;
  proTenants: number;
}

export interface AdminTenant {
  id: string;
  name: string;
  slug: string;
  plan: "FREE" | "PRO" | "PROPLUS";
  isActive: boolean;
  createdAt: string;
  _count: { clients: number };
  users: Array<{
    id: string;
    fullName: string;
    email: string;
    licenseStatus: "PENDING" | "VERIFIED" | "REJECTED";
    isActive: boolean;
  }>;
}

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  licenseStatus: "PENDING" | "VERIFIED" | "REJECTED";
  isActive: boolean;
  is2faEnabled: boolean;
  createdAt: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    isActive: boolean;
  };
}

export interface PendingLicense {
  id: string;
  fullName: string;
  email: string;
  licenseStatus: string;
  licenseDocUrl: string | null;
  createdAt: string;
  tenant: { name: string; slug: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export const fetchAdminStats = () =>
  apiFetch<AdminStats>("/admin/stats");

export const fetchAdminTenants = (params?: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.search) q.set("search", params.search);
  return apiFetch<PaginatedResponse<AdminTenant>>(
    `/admin/tenants${q.toString() ? `?${q}` : ""}`
  );
};

export const toggleTenantActive = (id: string) =>
  apiFetch<AdminTenant>(`/admin/tenants/${id}/toggle`, { method: "PATCH" });

export const fetchAdminUsers = (params?: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.search) q.set("search", params.search);
  return apiFetch<PaginatedResponse<AdminUser>>(
    `/admin/users${q.toString() ? `?${q}` : ""}`
  );
};

export const toggleUserActive = (id: string) =>
  apiFetch<AdminUser>(`/admin/users/${id}/toggle`, { method: "PATCH" });

export const fetchPendingLicenses = () =>
  apiFetch<PendingLicense[]>("/admin/licenses/pending");

export const approveLicense = (userId: string) =>
  apiFetch(`/admin/licenses/${userId}/approve`, { method: "PATCH" });

export const rejectLicense = (userId: string) =>
  apiFetch(`/admin/licenses/${userId}/reject`, { method: "PATCH" });

export interface SystemConfig {
  useAuth0: string; // "true" | "false"
}

export const fetchSystemConfig = () =>
  apiFetch<SystemConfig>("/admin/system-config");

export const updateSystemConfig = (dto: { useAuth0?: boolean }) =>
  apiFetch<SystemConfig>("/admin/system-config", {
    method: "PATCH",
    body: JSON.stringify(dto),
  });

export interface PlanConfig {
  planCode: "FREE" | "PRO" | "PROPLUS";
  monthlySessionQuota: number;
  testsPerSession: number;
  monthlyPrice: number;
  trialDays: number;
  updatedAt: string;
}

export const fetchPlanConfigs = () =>
  apiFetch<PlanConfig[]>("/admin/plan-config");

export const updatePlanConfig = (dto: {
  planCode: "FREE" | "PRO" | "PROPLUS";
  monthlySessionQuota: number;
  testsPerSession?: number;
  monthlyPrice?: number;
  trialDays?: number;
}) =>
  apiFetch<PlanConfig>("/admin/plan-config", {
    method: "POST",
    body: JSON.stringify(dto),
  });
