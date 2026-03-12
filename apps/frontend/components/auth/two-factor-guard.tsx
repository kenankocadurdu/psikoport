"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface User {
  id: string;
  role: string;
  is2faEnabled: boolean;
  systemRequires2FA: boolean;
}

/**
 * Dashboard layout'u saran guard.
 * - systemRequires2FA=false ise 2FA kurulum yönlendirmesi yapılmaz.
 * - Auth servisi geçici olarak erişilemez durumdaysa (ağ hatası)
 *   kullanıcıyı /login'e atmak yerine "Yeniden Dene" ekranı gösterir.
 */
export function TwoFactorGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [networkError, setNetworkError] = useState(false);

  const check = useCallback(async () => {
    setNetworkError(false);
    setIsChecking(true);

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token")
        : null;

    try {
      const res = await fetch("/api/auth/me", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.status === 401) {
        router.replace("/login");
        return;
      }

      if (res.status === 403) {
        const data = await res.json();
        if (data?.error?.code === "2FA_REQUIRED" || data?.error?.redirectTo) {
          router.replace("/setup-2fa");
          return;
        }
      }

      if (!res.ok) {
        router.replace("/login");
        return;
      }

      const user = (await res.json()) as User;

      if (user.role === "SUPER_ADMIN") {
        router.replace("/admin");
        return;
      }

      // Sistem genelinde 2FA zorunlu değilse kurulum kontrolü atlanır
      if (user.systemRequires2FA && !user.is2faEnabled) {
        router.replace("/setup-2fa");
        return;
      }

      setIsChecking(false);
    } catch {
      // Ağ hatası — auth servisi geçici olarak erişilemez.
      // Kullanıcıyı /login'e yönlendirmek yerine retry ekranı göster.
      setNetworkError(true);
      setIsChecking(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pathname === "/setup-2fa") {
      setIsChecking(false);
      return;
    }
    check();
  // router kasıtlı olarak bağımlılık listesinde YOK — açıklama: useRouter() bazı
  // React/Next.js sürümlerinde her render'da değişir ve sonsuz istek döngüsüne yol açar.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (isChecking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (networkError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <RefreshCw className="size-6 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold">Sunucuya ulaşılamıyor</p>
          <p className="text-sm text-muted-foreground mt-1">
            Kimlik doğrulama servisi geçici olarak erişilemez durumda.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={check}>
          <RefreshCw className="size-4 mr-2" />
          Yeniden Dene
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
