"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Download,
  LogIn,
  Mail,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

interface RegistrationData {
  plan: string;
  email: string;
  name: string;
  paid: boolean;
  billingPeriod: string;
}

export default function RegisterSuccessPage() {
  const router = useRouter();
  const [data, setData] = useState<RegistrationData | null>(null);
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const raw = sessionStorage.getItem("registration_complete");
    if (!raw) {
      router.replace("/login");
      return;
    }
    try {
      setData(JSON.parse(raw) as RegistrationData);
      sessionStorage.removeItem("registration_complete");
    } catch {
      router.replace("/login");
    }
  }, [router]);

  if (!data) return null;

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-4 pt-10 pb-12">
      <div className="flex justify-center">
        <Logo size="md" />
      </div>

      {/* Başarı banner */}
      <div className="rounded-2xl border-2 border-secondary/40 bg-secondary/5 px-6 py-6 text-center space-y-2">
        <CheckCircle2 className="mx-auto size-12 text-secondary" />
        <h1 className="text-2xl font-bold">Hesabınız oluşturuldu!</h1>
        <p className="text-sm text-muted-foreground">
          Hoş geldiniz, <span className="font-medium text-foreground">{data.name}</span>.
        </p>
        <div className="pt-1 flex justify-center gap-2 flex-wrap">
          <Badge variant="secondary">
            {data.plan === "pro" ? "Pro Plan" : "Ücretsiz Deneme"}
          </Badge>
          {data.paid && (
            <Badge variant="outline">
              {data.billingPeriod === "yearly" ? "Yıllık faturalama" : "Aylık faturalama"}
            </Badge>
          )}
        </div>
      </div>

      {/* Bilgi kartları */}
      <div className="space-y-3">
        {/* E-fatura */}
        {data.paid && (
          <div className="flex gap-4 rounded-xl border bg-background p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Mail className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">E-fatura e-postanıza gönderilecek</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{data.email}</span> adresine
                faturanız 24 saat içinde iletilecektir. Spam klasörünüzü de kontrol edin.
              </p>
            </div>
          </div>
        )}

        {/* 2FA */}
        <div className="flex gap-4 rounded-xl border bg-background p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
            <ShieldCheck className="size-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold">İki faktörlü doğrulama (2FA)</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              İlk girişinizde hesabınızı korumak için 2FA kurulumunu tamamlamanız
              istenecektir. Google Authenticator veya Authy uygulamalarından birini
              telefonunuza kurmanızı öneririz.
            </p>
          </div>
        </div>

        {/* Mobil uygulama / ileride */}
        <div className="flex gap-4 rounded-xl border bg-background p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Smartphone className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold">Sistemi nasıl kullanırsınız?</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Giriş ve temel kullanım kılavuzunu aşağıdaki butona tıklayarak PDF olarak
              indirebilirsiniz. Kılavuz; ilk giriş, 2FA kurulumu ve temel özellikleri
              kapsamaktadır.
            </p>
          </div>
        </div>
      </div>

      {/* Aksiyon butonları */}
      <div className="flex flex-col gap-3">
        <Button
          size="lg"
          className="w-full cursor-pointer"
          variant="outline"
          onClick={() => window.open("/register/guide", "_blank")}
        >
          <Download className="size-4" />
          Kullanım Kılavuzunu İndir (PDF)
        </Button>

        <Button size="lg" className="w-full cursor-pointer" asChild>
          <Link href="/login">
            <LogIn className="size-4" />
            Giriş Yap
          </Link>
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Sorularınız için{" "}
        <a href="mailto:destek@psikoport.com" className="underline hover:text-foreground">
          destek@psikoport.com
        </a>
      </p>
    </div>
  );
}
