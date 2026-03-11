"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAdminStats } from "@/lib/api/admin";
import {
  Building2,
  CheckCircle2,
  Users,
  FileWarning,
  CreditCard,
  Star,
  Loader2,
} from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  iconBg: string;
}

function StatCard({ label, value, sub, icon: Icon, color, iconBg }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={`flex size-10 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: fetchAdminStats,
    refetchInterval: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Genel Bakış</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Platformun anlık durumu
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Toplam Tenant"
          value={stats?.totalTenants ?? 0}
          sub={`${stats?.activeTenants ?? 0} aktif`}
          icon={Building2}
          color="text-foreground"
          iconBg="bg-primary/10 text-primary"
        />
        <StatCard
          label="Aktif Tenant"
          value={stats?.activeTenants ?? 0}
          sub={`${(stats?.totalTenants ?? 0) - (stats?.activeTenants ?? 0)} pasif`}
          icon={CheckCircle2}
          color="text-emerald-600 dark:text-emerald-400"
          iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
        />
        <StatCard
          label="Toplam Psikolog"
          value={stats?.totalPsychologists ?? 0}
          icon={Users}
          color="text-foreground"
          iconBg="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
        />
        <StatCard
          label="Bekleyen Lisans"
          value={stats?.pendingLicenses ?? 0}
          sub="onay bekliyor"
          icon={FileWarning}
          color={
            (stats?.pendingLicenses ?? 0) > 0
              ? "text-amber-600 dark:text-amber-400"
              : "text-foreground"
          }
          iconBg="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
        />
        <StatCard
          label="Ücretsiz Plan"
          value={stats?.freeTenants ?? 0}
          icon={CreditCard}
          color="text-foreground"
          iconBg="bg-muted text-muted-foreground"
        />
        <StatCard
          label="Pro Plan"
          value={stats?.proTenants ?? 0}
          icon={Star}
          color="text-foreground"
          iconBg="bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
        />
      </div>
    </div>
  );
}
