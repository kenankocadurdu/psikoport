"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const APP_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Auth0 callback sonrası: session cookie'den access token alıp localStorage'a yazar.
 * API Bearer token beklediği için bu adım gerekli.
 */
export default function SyncTokenPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "not-registered">("loading");

  useEffect(() => {
    const sync = async () => {
      try {
        console.log("[sync-token] access-token alınıyor...");
        const res = await fetch(`${APP_URL}/api/auth/access-token`, {
          credentials: "include",
        });

        if (!res.ok) {
          console.warn("[sync-token] access-token başarısız:", res.status);
          router.replace("/login");
          return;
        }

        const data = (await res.json()) as {
          token?: string;
          accessToken?: string;
          access_token?: string;
        };
        const token =
          data?.token ?? data?.accessToken ?? data?.access_token;

        if (!token) {
          console.warn("[sync-token] token bulunamadı, data:", data);
          router.replace("/login");
          return;
        }

        localStorage.setItem("access_token", token);
        sessionStorage.setItem("access_token", token);
        setStatus("ok");
        console.log("[sync-token] token localStorage'a yazıldı");

        // loginCallback: AMR claim veya Management API enrollment kontrolü ile
        // is2faEnabled flag'ini DB'de günceller.
        let cbIs2faEnabled: boolean | null = null;
        try {
          const cbRes = await fetch(`${API_URL}/auth/login-callback`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ auth0Token: token }),
          });
          if (cbRes.ok) {
            const cbData = (await cbRes.json()) as { is2faEnabled?: boolean };
            cbIs2faEnabled = cbData.is2faEnabled ?? null;
            console.log("[sync-token] loginCallback:", cbData);
          } else if (cbRes.status === 401) {
            // Kullanıcı Auth0'da var ama sistemde kayıtlı değil (doğrudan Auth0 sign-up yapmış)
            const errText = await cbRes.text().catch(() => "");
            console.warn("[sync-token] loginCallback 401 — kayıtsız kullanıcı:", errText);
            setStatus("not-registered");
            return;
          } else {
            console.warn("[sync-token] loginCallback HTTP hatası:", cbRes.status, await cbRes.text().catch(() => ""));
          }
        } catch (e) {
          console.warn("[sync-token] loginCallback network hatası:", e);
        }

        // /api/auth/me ile kullanıcı ve sistem ayarlarını kontrol et
        console.log("[sync-token] /api/auth/me kontrol ediliyor...");
        const meRes = await fetch("/api/auth/me", {
          credentials: "include",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        console.log("[sync-token] /api/auth/me yanıtı:", meRes.status);
        if (meRes.ok) {
          const user = (await meRes.json()) as {
            is2faEnabled?: boolean;
            systemRequires2FA?: boolean;
          };
          console.log("[sync-token] me kullanıcı:", user);

          // 2FA sistem genelinde zorunlu değilse veya kullanıcı kurulumu tamamlamışsa → dashboard
          if (!user.systemRequires2FA || user.is2faEnabled || cbIs2faEnabled === true) {
            window.location.replace("/");
            return;
          }
        } else if (cbIs2faEnabled === true) {
          window.location.replace("/");
          return;
        }
        console.log("[sync-token] is2faEnabled=false ve systemRequires2FA=true → /setup-2fa");
        window.location.replace("/setup-2fa");
      } catch (e) {
        console.error("[sync-token] beklenmedik hata:", e);
        setStatus("error");
        router.replace("/login");
      }
    };

    sync();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        {status === "loading" && (
          <>
            <div className="mx-auto size-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-4 text-muted-foreground">Oturum hazırlanıyor...</p>
          </>
        )}
        {status === "ok" && (
          <p className="text-muted-foreground">Yönlendiriliyor...</p>
        )}
        {status === "error" && (
          <p className="text-destructive">Bir hata oluştu. Giriş sayfasına yönlendiriliyorsunuz.</p>
        )}
        {status === "not-registered" && (
          <div className="space-y-3">
            <p className="font-medium text-destructive">Hesabınız sistemde kayıtlı değil.</p>
            <p className="text-sm text-muted-foreground">
              Lütfen kayıt formunu kullanarak hesap oluşturun.
            </p>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Auth0 logout API route, Link component can't handle this */}
            <a
              href="/api/auth/logout?returnTo=/register"
              className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Kayıt Ol
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
