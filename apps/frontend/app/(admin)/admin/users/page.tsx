"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAdminUsers, toggleUserActive, type AdminUser } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  ShieldCheck,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

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

const PLAN_LABELS: Record<string, string> = {
  FREE: "Ücretsiz",
  PRO: "Pro",
  ENTERPRISE: "Kurumsal",
};

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 15;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", page, search],
    queryFn: () => fetchAdminUsers({ page, limit: LIMIT, search: search || undefined }),
  });

  const toggleMutation = useMutation({
    mutationFn: toggleUserActive,
    onSuccess: (updated) => {
      toast.success(updated.isActive ? "Kullanıcı aktif edildi" : "Kullanıcı pasife alındı");
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
          <h1 className="text-2xl font-bold tracking-tight">Kullanıcılar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data ? `Toplam ${data.total} psikolog` : "Yükleniyor..."}
          </p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="İsim veya e-posta ara..."
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
          <Users className="size-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Kullanıcı bulunamadı</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Kullanıcı
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Tenant / Plan
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Lisans
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    2FA
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
                {data.data.map((user: AdminUser) => (
                  <tr
                    key={user.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{user.fullName}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-[120px]">
                        {user.tenant.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {PLAN_LABELS[user.tenant.plan] ?? user.tenant.plan}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={LICENSE_VARIANTS[user.licenseStatus] ?? "outline"}
                        className="text-[10px] px-1.5 py-0 h-4"
                      >
                        {LICENSE_LABELS[user.licenseStatus] ?? user.licenseStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {user.is2faEnabled ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck className="size-3.5" />
                          Aktif
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Shield className="size-3.5" />
                          Pasif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                          user.isActive
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                        }`}
                      >
                        {user.isActive ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {format(new Date(user.createdAt), "d MMM yyyy", { locale: tr })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant={user.isActive ? "outline" : "default"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => toggleMutation.mutate(user.id)}
                        disabled={toggleMutation.isPending}
                      >
                        {user.isActive ? "Pasife Al" : "Aktif Et"}
                      </Button>
                    </td>
                  </tr>
                ))}
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
