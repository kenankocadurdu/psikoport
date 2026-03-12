"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSystemConfig, updateSystemConfig } from "@/lib/api/admin";
import { toast } from "sonner";
import { Loader2, KeyRound, Globe } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["admin", "system-config"],
    queryFn: fetchSystemConfig,
  });

  const mutation = useMutation({
    mutationFn: updateSystemConfig,
    onSuccess: (data) => {
      queryClient.setQueryData(["admin", "system-config"], data);
    },
    onError: () => toast.error("Ayar güncellenemedi"),
  });

  const useAuth0 = config?.useAuth0 !== "false";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sistem Ayarları</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Platform genelinde geçerli güvenlik ve erişim ayarları
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kimlik Doğrulama Yöntemi</CardTitle>
          <CardDescription>
            <strong>Auth0 aktif:</strong> Kullanıcılar Auth0 üzerinden giriş yapar, 2FA desteklenir (Auth0 panelinden yönetilir).
            <br />
            <strong>Auth0 pasif:</strong> Kullanıcılar sisteme kayıtlı e-posta/şifreleriyle doğrudan giriş yapar.
            Auth0 ve 2FA tamamen devre dışı kalır.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className={`flex size-9 items-center justify-center rounded-lg ${useAuth0 ? "bg-primary/10" : "bg-muted"}`}>
                {useAuth0 ? (
                  <Globe className="size-5 text-primary" />
                ) : (
                  <KeyRound className="size-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">
                  {useAuth0 ? "Auth0 Aktif" : "Yerel Giriş Aktif"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {useAuth0
                    ? "Giriş ve 2FA Auth0 üzerinden yönetilir"
                    : "Giriş kendi veritabanımızdan gerçekleşir"}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => {
                mutation.mutate({ useAuth0: !useAuth0 });
                toast.success(!useAuth0 ? "Auth0 aktif edildi" : "Yerel giriş moduna geçildi");
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                useAuth0 ? "bg-primary" : "bg-muted-foreground/30"
              }`}
              role="switch"
              aria-checked={useAuth0}
            >
              <span
                className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ${
                  useAuth0 ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {!useAuth0 && (
            <p className="rounded-lg bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-400">
              Yerel modda yeni kayıt olan kullanıcılar şifrelerini sisteme kaydeder.
              Auth0&apos;da daha önce kayıtlı kullanıcılar da şifrelerini yerel DB&apos;ye kaydetmiş olmalıdır.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
