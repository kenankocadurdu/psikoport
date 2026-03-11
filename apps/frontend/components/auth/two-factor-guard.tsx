"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";


interface User {
  id: string;
  role: string;
  is2faEnabled: boolean;
}

/**
 * is2faEnabled = false ise /setup-2fa'ya yönlendirir.
 * Dashboard layout içinde kullanılır.
 * İlk kontrol: /api/auth/me proxy (session cookie → CORS yok).
 * Proxy yoksa: doğrudan API + localStorage token.
 */
export function TwoFactorGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token")
          : null;

      console.log("[TwoFactorGuard] kontrol başlıyor, pathname:", pathname, "token var mı:", !!token);

      // Proxy kullan: session cookie ile, CORS/token timing sorununu bypass eder
      const meUrl = "/api/auth/me";
      try {
        const res = await fetch(meUrl, {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        console.log("[TwoFactorGuard] /api/auth/me yanıtı:", res.status);

        if (res.status === 401) {
          console.warn("[TwoFactorGuard] 401 → /login");
          router.replace("/login");
          return;
        }

        if (res.status === 403) {
          const data = await res.json();
          if (data?.error?.code === "2FA_REQUIRED" || data?.error?.redirectTo) {
            console.warn("[TwoFactorGuard] 403 2FA_REQUIRED → /setup-2fa");
            router.replace("/setup-2fa");
            return;
          }
        }

        if (!res.ok) {
          console.warn("[TwoFactorGuard] non-OK yanıt:", res.status, "→ /login");
          router.replace("/login");
          return;
        }

        const user = (await res.json()) as User;
        console.log("[TwoFactorGuard] kullanıcı:", user);

        if (user.role === "SUPER_ADMIN") {
          router.replace("/admin");
          return;
        }

        if (!user.is2faEnabled) {
          console.warn("[TwoFactorGuard] is2faEnabled=false → /setup-2fa");
          router.replace("/setup-2fa");
          return;
        }

        setIsChecking(false);
      } catch (e) {
        console.error("[TwoFactorGuard] hata:", e, "→ /login");
        router.replace("/login");
      }
    };

    if (pathname === "/setup-2fa") {
      setIsChecking(false);
      return;
    }

    check();
  // router kasıtlı olarak bağımlılık listesinde YOK.
  // useRouter() next/navigation'da stabil bir obje döndürür; listeye eklemek
  // bazı React/Next.js sürümlerinde her render'da effect'i yeniden tetikler,
  // bu da /api/auth/me'ye saniyede düzinelerce istek atılmasına ve 429'a yol açar.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (isChecking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
