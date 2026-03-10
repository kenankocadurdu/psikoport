"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Check, CreditCard, Loader2 } from "lucide-react";
import { SUBSCRIPTION_PLANS } from "@psikoport/shared";
import { Logo } from "@/components/logo";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type PlanCode = "free" | "pro" | "enterprise";

const registerSchema = z.object({
  fullName: z.string().min(2, "Ad soyad en az 2 karakter olmalı").max(100),
  email: z.string().email("Geçerli bir e-posta adresi girin"),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı"),
  phone: z.string().max(20).optional().or(z.literal("")),
});

type RegisterForm = z.infer<typeof registerSchema>;

function formatCardNumber(value: string) {
  const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
  const match = v.match(/.{1,4}/g);
  return match ? match.join(" ") : v;
}

function formatExpiry(value: string) {
  const v = value.replace(/\D/g, "");
  if (v.length >= 2) return `${v.slice(0, 2)}/${v.slice(2, 4)}`;
  return v;
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"plan" | "details">("plan");
  const [selectedPlan, setSelectedPlan] = useState<PlanCode>("pro");
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);

  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", phone: "" },
  });

  const plan = SUBSCRIPTION_PLANS.find((p) => p.code === selectedPlan)!;
  const isPaid = selectedPlan !== "free";

  const onSubmit = form.handleSubmit(async (values) => {
    if (isPaid) {
      if (!cardNumber || cardNumber.replace(/\s/g, "").length < 16) {
        toast.error("Geçerli bir kart numarası girin");
        return;
      }
      if (!cardName.trim()) {
        toast.error("Kart üzerindeki ismi girin");
        return;
      }
      if (!expiry || expiry.length < 5) {
        toast.error("Son kullanma tarihini girin (AA/YY)");
        return;
      }
      if (!cvc || cvc.length < 3) {
        toast.error("CVC girin");
        return;
      }
    }

    setLoadingMsg("Hesap oluşturuluyor...");
    try {
      // 1. Önce kayıt — Auth0 + DB
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: values.fullName,
          email: values.email,
          password: values.password,
          phone: values.phone || undefined,
          plan: selectedPlan,
        }),
      });

      const data = (await res.json()) as {
        message?: string;
        error?: { message?: string };
      };
      if (!res.ok) {
        throw new Error(data?.error?.message ?? data?.message ?? "Kayıt başarısız");
      }

      // 2. Kayıt başarılı → ödemeyi al (sadece ücretli planlar)
      if (isPaid) {
        setLoadingMsg("Ödeme işleniyor...");
        await new Promise((resolve) => setTimeout(resolve, 1500));
        toast.success("Ödeme onaylandı");
      }

      toast.success("Hesabınız oluşturuldu! Giriş yapabilirsiniz.");
      router.push("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setLoadingMsg(null);
    }
  });

  /* ── Step 1: Plan Seçimi ─────────────────────────────────── */
  if (step === "plan") {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Logo size="lg" />
          <p className="text-sm text-muted-foreground">
            Planınızı seçin ve hemen kullanmaya başlayın
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {SUBSCRIPTION_PLANS.map((p) => (
            <button
              key={p.code}
              type="button"
              onClick={() => setSelectedPlan(p.code as PlanCode)}
              className={cn(
                "relative flex flex-col rounded-xl border-2 p-5 text-left transition-colors hover:border-primary/60",
                selectedPlan === p.code
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background",
              )}
            >
              {p.code === "pro" && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  Popüler
                </Badge>
              )}
              {selectedPlan === p.code && (
                <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" />
                </span>
              )}
              <div className="mb-3">
                <div className="font-semibold">{p.name}</div>
                <div className="mt-1 text-2xl font-bold">
                  {p.priceMonthly === 0 ? (
                    "Ücretsiz"
                  ) : (
                    <>
                      ₺{p.priceMonthly}
                      <span className="text-sm font-normal text-muted-foreground">/ay</span>
                    </>
                  )}
                </div>
              </div>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Giriş sayfasına dön
          </Link>
          <Button onClick={() => setStep("details")} size="lg">
            İleri
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  /* ── Step 2: Hesap Bilgileri + Ödeme ────────────────────── */
  return (
    <div className="mx-auto w-full max-w-lg space-y-5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep("plan")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Plan seçimine dön
        </button>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{plan.name}</span>
          {isPaid ? (
            <span className="text-muted-foreground">· ₺{plan.priceMonthly}/ay</span>
          ) : (
            <Badge variant="secondary">Ücretsiz</Badge>
          )}
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {/* Hesap bilgileri */}
        <div className="space-y-4 rounded-xl border bg-background p-5">
          <h2 className="font-semibold">Hesap Bilgileri</h2>

          <div className="space-y-2">
            <Label htmlFor="fullName">Ad Soyad</Label>
            <Input
              id="fullName"
              {...form.register("fullName")}
              placeholder="Adınız Soyadınız"
              autoComplete="name"
            />
            {form.formState.errors.fullName && (
              <p className="text-sm text-destructive">
                {form.formState.errors.fullName.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input
              id="email"
              type="email"
              {...form.register("email")}
              placeholder="ornek@email.com"
              autoComplete="email"
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Şifre</Label>
            <Input
              id="password"
              type="password"
              {...form.register("password")}
              placeholder="En az 8 karakter"
              autoComplete="new-password"
            />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefon (opsiyonel)</Label>
            <Input
              id="phone"
              type="tel"
              {...form.register("phone")}
              placeholder="+90 5XX XXX XX XX"
            />
          </div>
        </div>

        {/* Ödeme bilgileri — sadece ücretli planlar */}
        {isPaid && (
          <div className="space-y-4 rounded-xl border bg-background p-5">
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-muted-foreground" />
              <h2 className="font-semibold">Ödeme Bilgileri</h2>
              <Badge variant="outline" className="ml-auto text-xs">
                Simülasyon
              </Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardNumber">Kart Numarası</Label>
              <Input
                id="cardNumber"
                placeholder="4242 4242 4242 4242"
                maxLength={19}
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardName">Kart Üzerindeki İsim</Label>
              <Input
                id="cardName"
                placeholder="AD SOYAD"
                value={cardName}
                onChange={(e) => setCardName(e.target.value.toUpperCase())}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expiry">Son Kullanma (AA/YY)</Label>
                <Input
                  id="expiry"
                  placeholder="12/28"
                  maxLength={5}
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cvc">CVC</Label>
                <Input
                  id="cvc"
                  placeholder="123"
                  maxLength={4}
                  type="password"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>
          </div>
        )}

        {/* Özet */}
        <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          {isPaid ? (
            <>
              <span className="font-medium text-foreground">{plan.name}</span> planı — aylık{" "}
              <span className="font-medium text-foreground">₺{plan.priceMonthly}</span>{" "}
              ücretlendirileceksiniz.{" "}
              <span className="text-xs">(Simülasyon, gerçek ödeme alınmaz.)</span>
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">Ücretsiz</span> plan — ödeme
              gerekmez. Dilediğiniz zaman yükseltebilirsiniz.
            </>
          )}
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={!!loadingMsg}>
          {loadingMsg ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {loadingMsg}
            </>
          ) : isPaid ? (
            <>
              <CreditCard className="size-4" />
              Ödemeyi Tamamla ve Kayıt Ol
            </>
          ) : (
            "Ücretsiz Hesap Oluştur"
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Zaten hesabınız var mı?{" "}
          <Link href="/login" className="text-primary underline hover:no-underline">
            Giriş yapın
          </Link>
        </p>
      </form>
    </div>
  );
}
