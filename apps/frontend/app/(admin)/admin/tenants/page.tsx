"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAdminTenants, toggleTenantActive, type AdminTenant } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  UserCheck,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

const PLAN_LABELS: Record<string, string> = {
  FREE: "Ücretsiz",
  PRO: "Pro",
  PROPLUS: "Kurumsal",
};

const PLAN_COLORS: Record<string, string> = {
  FREE: "bg-muted text-muted-foreground",
  PRO: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  PROPLUS: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
};

const LICENSE_LABELS: Record<string, string> = {
  PENDING: "Bekliyor",
  VERIFIED: "Doğrulandı",
  REJECTED: "Reddedildi",
};

const LICENSE_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  PENDING: "outline",
  VERIFIED: "default",
  REJECTED: "destructive",
};

export default function AdminTenantsPage() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 15;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "tenants", page, search],
    queryFn: () => fetchAdminTenants({ page, limit: LIMIT, search: search || undefined }),
  });

  const toggleMutation = useMutation({
    mutationFn: toggleTenantActive,
    onSuccess: (updated) => {
      toast.success(updated.isActive ? "Tenant aktif edildi" : "Tenant pasife alındı");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: () => toast.error("İşlem başarısız"),
  });

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenantlar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data ? `Toplam ${data.total} tenant` : "Yükleniyor..."}
          </p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="İsim veya slug ara..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-56"
          />
          <Button type="submit" variant="outline" size="icon">
            <Search className="size-4" />
          </Button>
        </form>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data?.data.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <Building2 className="size-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Tenant bulunamadı</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Tenant
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Plan
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Psikolog
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Danışan
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Durum
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Kayıt
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    İşlem
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((tenant: AdminTenant) => {
                  const psychologist = tenant.users[0];
                  return (
                    <tr
                      key={tenant.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{tenant.name}</p>
                        <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${PLAN_COLORS[tenant.plan] ?? ""}`}
                        >
                          {PLAN_LABELS[tenant.plan] ?? tenant.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {psychologist ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium truncate max-w-[140px]">
                                {psychologist.fullName}
                              </p>
                              <Badge
                                variant={
                                  LICENSE_VARIANTS[psychologist.licenseStatus] ?? "outline"
                                }
                                className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                              >
                                {LICENSE_LABELS[psychologist.licenseStatus] ?? psychologist.licenseStatus}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                              {psychologist.email}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Users className="size-3.5" />
                          {tenant._count.clients}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
                            tenant.isActive
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                          }`}
                        >
                          {tenant.isActive ? "Aktif" : "Pasif"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {format(new Date(tenant.createdAt), "d MMM yyyy", { locale: tr })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant={tenant.isActive ? "outline" : "default"}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => toggleMutation.mutate(tenant.id)}
                          disabled={toggleMutation.isPending}
                        >
                          {tenant.isActive ? "Pasife Al" : "Aktif Et"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Sayfa {page} / {totalPages}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
