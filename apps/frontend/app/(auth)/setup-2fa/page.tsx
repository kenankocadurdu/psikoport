"use client";

import Link from "next/link";
import { Shield, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * 2FA kurulum sayfası — Auth0 MFA enrollment akışına yönlendirir.
 */
export default function Setup2FAPage() {
  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">2FA Kurulumu Zorunlu</h1>
          <p className="text-muted-foreground text-sm">
            Güvenlik politikası gereği iki adımlı doğrulama gereklidir.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Google Authenticator veya Benzeri Uygulama
          </CardTitle>
          <CardDescription>
            Auth0 giriş ekranında QR kodu tarayıcınızla okutun, ardından
            uygulamada oluşan kodu girin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
            <li>Google Authenticator, Microsoft Authenticator veya Authy indirin</li>
            <li>Aşağıdaki butona tıklayın — Auth0 giriş ekranına yönlendirileceksiniz</li>
            <li>Giriş yaptıktan sonra QR kodunu uygulamanızla tarayın</li>
            <li>Uygulamada görünen 6 haneli kodu girin</li>
            <li>Kurulum tamamlandığında panele erişebilirsiniz</li>
          </ol>

          <Button asChild size="lg" className="w-full">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API redirect, Link causes CORS */}
            <a href="/api/auth/start-2fa-setup">2FA Kurulumuna Başla</a>
          </Button>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        SMS yedek doğrulama Auth0 Dashboard MFA ayarlarından yapılandırılabilir.
      </p>
      <p className="text-center text-sm">
        <Link href="/auth/sync-token" className="text-primary underline underline-offset-2 hover:no-underline">
          2FA&apos;yı tamamladıysanız panele git →
        </Link>
      </p>
    </div>
  );
}
