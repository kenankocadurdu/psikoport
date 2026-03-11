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
import { ArrowLeft, ArrowRight, Check, CreditCard, Lock, Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type PlanCode = "free" | "pro" | "enterprise";
type DetailTab = "account" | "payment";
type BillingPeriod = "monthly" | "yearly";

const PRO_PRICE = { monthly: 999, yearly: 799 };

const PLANS = [
  {
    code: "free" as PlanCode,
    name: "Ücretsiz Deneme",
    tagline: "7 gün • Kredi kartı gerekmez",
    sessions: "25 seans",
    sessionLabel: "deneme süresi boyunca",
    features: [
      "Randevu planlama",
      "Temel Seans Notları",
      "Temel gelir takibi",
      "10 psikometrik test",
    ],
  },
  {
    code: "pro" as PlanCode,
    name: "Pro",
    tagline: "Pratiğinizi tam kapasiteyle büyütün",
    sessions: "250 seans",
    sessionLabel: "her ay",
    features: [
      "Randevu planlama",
      "Gelişmiş Seans Notları ve Araçları",
      "Gelişmiş gelir takibi",
      "10 psikometrik test",
      "Seans hatırlatma bildirimleri",
    ],
    extras: ["Ticket sistemi ile hızlı destek (08:00 - 20:00)"],
  },
];

const registerSchema = z.object({
  fullName: z.string().min(2, "Ad soyad en az 2 karakter olmalı").max(100),
  email: z.string().email({ message: "Geçerli bir e-posta adresi girin" }),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı"),
  confirmPassword: z.string(),
  phone: z.string().max(20).optional().or(z.literal("")),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Şifreler eşleşmiyor",
  path: ["confirmPassword"],
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
  const [detailTab, setDetailTab] = useState<DetailTab>("account");
  const [accountUnlocked, setAccountUnlocked] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");

  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "", phone: "" },
  });

  const plan = PLANS.find((p) => p.code === selectedPlan)!;
  const isPaid = selectedPlan !== "free";

  /* Hesap alanlarını doğrulayıp ödeme tabına geç */
  const handleGoToPayment = async () => {
    const valid = await form.trigger(["fullName", "email", "password", "confirmPassword"]);
    if (!valid) return;
    setAccountUnlocked(true);
    setDetailTab("payment");
  };

  /* Manuel submit — form element yok, implicit submit yok */
  const handleSubmit = async () => {
    const valid = await form.trigger();
    if (!valid) return;

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

    const values = form.getValues();
    setLoadingMsg("Hesap oluşturuluyor...");
    try {
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

      if (isPaid) {
        setLoadingMsg("Ödeme işleniyor...");
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      sessionStorage.setItem("registration_complete", JSON.stringify({
        plan: selectedPlan,
        email: values.email,
        name: values.fullName,
        paid: isPaid,
        billingPeriod,
      }));
      router.push("/register/success");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setLoadingMsg(null);
    }
  };

  /* ── Step 1: Plan Seçimi ─────────────────────────────────── */
  if (step === "plan") {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pt-6 pb-12">
        <div className="flex flex-col items-center gap-3">
          <Logo size="lg" />
          <p className="text-sm text-muted-foreground">
            Planınızı seçin ve hemen kullanmaya başlayın
          </p>
        </div>

        {/* Fatura dönemi toggle — sadece Pro için anlam taşır */}
        <div className="flex justify-center">
          <div className="flex rounded-xl border bg-muted/40 p-1 gap-1">
            <button
              type="button"
              onClick={() => setBillingPeriod("monthly")}
              className={cn(
                "cursor-pointer rounded-lg px-5 py-2 text-sm font-medium transition-colors",
                billingPeriod === "monthly"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Aylık
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod("yearly")}
              className={cn(
                "cursor-pointer rounded-lg px-5 py-2 text-sm font-medium transition-colors flex items-center gap-2",
                billingPeriod === "yearly"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Yıllık
              <Badge variant="secondary" className="text-xs py-0">%20 indirim</Badge>
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {PLANS.map((p) => {
            const price = p.code === "pro" ? PRO_PRICE[billingPeriod] : 0;
            const isSelected = selectedPlan === p.code;
            return (
              <button
                key={p.code}
                type="button"
                onClick={() => setSelectedPlan(p.code)}
                className={cn(
                  "relative flex cursor-pointer flex-col rounded-xl border-2 p-5 text-left transition-colors hover:border-primary/60",
                  isSelected ? "border-primary bg-primary/5" : "border-border bg-background",
                )}
              >
                {p.code === "pro" && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    Popüler
                  </Badge>
                )}
                {isSelected && (
                  <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                )}

                {/* Fiyat */}
                <div className="mb-4">
                  <div className="font-semibold">{p.name}</div>
                  <div className="mt-1 text-2xl font-bold">
                    {price === 0 ? "Ücretsiz" : (
                      <>₺{price}<span className="text-sm font-normal text-muted-foreground">/ay</span></>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.code === "pro" && billingPeriod === "yearly"
                      ? `Yıllık ₺${PRO_PRICE.yearly * 12} faturalandırılır`
                      : "\u00A0"}
                  </p>
                </div>

                {/* Seans kapasitesi */}
                <div className="mb-3 rounded-lg bg-primary/8 px-3 py-2">
                  <span className="text-lg font-bold text-primary">{p.sessions}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">{p.sessionLabel}</span>
                </div>

                {/* Her seans içerir */}
                <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Her seans içerir
                </p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5">
                      <Check className="size-3.5 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>

                {"extras" in p && p.extras.length > 0 && (
                  <>
                    <p className="mt-3 mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Ayrıca
                    </p>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      {p.extras.map((f) => (
                        <li key={f} className="flex items-center gap-1.5">
                          <Check className="size-3.5 shrink-0 text-secondary" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex gap-3">
          <Button size="lg" className="flex-1 cursor-pointer" asChild>
            <Link href="/login">
              <ArrowLeft className="size-4" />
              Giriş sayfasına dön
            </Link>
          </Button>
          <Button size="lg" className="flex-1 cursor-pointer" onClick={() => setStep("details")}>
            İleri
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  /* ── Step 2: Hesap Bilgileri + Ödeme ────────────────────── */
  return (
    <div className="mx-auto w-full max-w-lg space-y-5 px-4 pt-6 pb-12">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <Logo size="md" />
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{plan.name}</span>
          {isPaid ? (
            <Badge variant="secondary">
              ₺{PRO_PRICE[billingPeriod]}/ay · {billingPeriod === "yearly" ? "Yıllık" : "Aylık"}
            </Badge>
          ) : (
            <Badge variant="secondary">Ücretsiz</Badge>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {/* Tab başlıkları — sadece ücretli planda göster */}
        {isPaid && (
          <div className="flex rounded-xl border bg-muted/40 p-1 gap-1">
            <button
              type="button"
              onClick={() => setDetailTab("account")}
              className={cn(
                "flex-1 cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                detailTab === "account"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Hesap Bilgileri
            </button>
            <button
              type="button"
              onClick={accountUnlocked ? () => setDetailTab("payment") : handleGoToPayment}
              className={cn(
                "flex-1 cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                detailTab === "payment"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {!accountUnlocked && <Lock className="size-3" />}
              Ödeme Bilgileri
            </button>
          </div>
        )}

        {/* Tab: Hesap Bilgileri */}
        {(!isPaid || detailTab === "account") && (
          <div className="space-y-4 rounded-xl border bg-background p-5">
            {!isPaid && <h2 className="font-semibold">Hesap Bilgileri</h2>}

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
              <Label htmlFor="confirmPassword">Şifre Tekrarı</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...form.register("confirmPassword")}
                placeholder="Şifrenizi tekrar girin"
                autoComplete="new-password"
              />
              {form.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.confirmPassword.message}
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
        )}

        {/* Tab: Ödeme Bilgileri */}
        {isPaid && detailTab === "payment" && (
          <div className="space-y-4 rounded-xl border bg-background p-5">
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-muted-foreground" />
              <h2 className="font-semibold">Ödeme Bilgileri</h2>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardNumber">Kart Numarası</Label>
              <Input
                id="cardNumber"
                placeholder="4242 4242 4242 4242"
                maxLength={19}
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore
                inputMode="numeric"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardName">Kart Üzerindeki İsim</Label>
              <Input
                id="cardName"
                placeholder="AD SOYAD"
                value={cardName}
                onChange={(e) => setCardName(e.target.value.toUpperCase())}
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore
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
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cvc">CVC</Label>
                <Input
                  id="cvc"
                  placeholder="123"
                  maxLength={4}
                  type="text"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, ""))}
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>
        )}

        {/* Özet */}
        <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          {isPaid ? (
            <>
              <span className="font-medium text-foreground">{plan.name}</span> planı —{" "}
              {billingPeriod === "yearly" ? (
                <>yıllık <span className="font-medium text-foreground">₺{PRO_PRICE.yearly * 12}</span> ücretlendirileceksiniz.</>
              ) : (
                <>aylık <span className="font-medium text-foreground">₺{PRO_PRICE.monthly}</span> ücretlendirileceksiniz.</>
              )}
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">Ücretsiz</span> plan — ödeme
              gerekmez. Dilediğiniz zaman yükseltebilirsiniz.
            </>
          )}
        </div>

        {/* Alt navigasyon */}
        <div className="flex gap-3">
          <Button
            size="lg"
            className="flex-1 cursor-pointer"
            type="button"
            onClick={() => {
              if (isPaid && detailTab === "payment") {
                setDetailTab("account");
              } else {
                setStep("plan");
              }
            }}
          >
            <ArrowLeft className="size-4" />
            {isPaid && detailTab === "payment" ? "Hesap Bilgileri" : "Plan seçimine dön"}
          </Button>

          {isPaid && detailTab === "account" ? (
            <Button
              size="lg"
              className="flex-1 cursor-pointer"
              type="button"
              onClick={handleGoToPayment}
            >
              Ödeme Adımı
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button
              size="lg"
              className="flex-1 cursor-pointer"
              type="button"
              onClick={handleSubmit}
              disabled={!!loadingMsg}
            >
              {loadingMsg ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {loadingMsg}
                </>
              ) : isPaid ? (
                <>
                  <CreditCard className="size-4" />
                  Ödemeyi Tamamla
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  Hesap Oluştur
                </>
              )}
            </Button>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Zaten hesabınız var mı?{" "}
          <Link href="/login" className="text-primary underline hover:no-underline">
            Giriş yapın
          </Link>
        </p>
      </div>
    </div>
  );
}
