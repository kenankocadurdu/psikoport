"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPendingLicenses, approveLicense, rejectLicense, type PendingLicense } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { FileCheck, FileX, Loader2, ExternalLink, FileWarning } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export default function AdminLicensesPage() {
  const queryClient = useQueryClient();

  const { data: licenses, isLoading } = useQuery({
    queryKey: ["admin", "licenses", "pending"],
    queryFn: fetchPendingLicenses,
    refetchInterval: 30 * 1000,
  });

  const approveMutation = useMutation({
    mutationFn: approveLicense,
    onSuccess: () => {
      toast.success("Lisans onaylandı");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: () => toast.error("İşlem başarısız"),
  });

  const rejectMutation = useMutation({
    mutationFn: rejectLicense,
    onSuccess: () => {
      toast.success("Lisans reddedildi");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: () => toast.error("İşlem başarısız"),
  });

  const isPending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lisans Onayları</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isLoading
            ? "Yükleniyor..."
            : `${licenses?.length ?? 0} bekleyen başvuru`}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : !licenses?.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <FileCheck className="size-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground font-medium">
            Bekleyen lisans başvurusu yok
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Yeni başvurular geldiğinde burada görünür
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {licenses.map((license: PendingLicense) => (
            <div
              key={license.id}
              className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4"
            >
              {/* İkon */}
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/40">
                <FileWarning className="size-5 text-amber-600 dark:text-amber-400" />
              </div>

              {/* Bilgiler */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{license.fullName}</p>
                  <span className="text-xs text-muted-foreground">
                    {license.tenant.name}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {license.email} ·{" "}
                  {format(new Date(license.createdAt), "d MMM yyyy, HH:mm", {
                    locale: tr,
                  })}
                </p>
              </div>

              {/* Eylemler */}
              <div className="flex items-center gap-2 shrink-0">
                {license.licenseDocUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={() => window.open(license.licenseDocUrl!, "_blank")}
                  >
                    <ExternalLink className="size-3.5" />
                    Belgeyi Gör
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                  onClick={() => rejectMutation.mutate(license.id)}
                  disabled={isPending}
                >
                  <FileX className="size-3.5" />
                  Reddet
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => approveMutation.mutate(license.id)}
                  disabled={isPending}
                >
                  <FileCheck className="size-3.5" />
                  Onayla
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
