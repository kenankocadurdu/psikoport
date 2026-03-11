"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPlanConfigs, updatePlanConfig } from "@/lib/api/admin";
import type { PlanConfig } from "@/lib/api/admin";
import { toast } from "sonner";
import { Loader2, Save, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const PLAN_META = {
  FREE: {
    label: "Ücretsiz Plan",
    color: "text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400",
    badgeLabel: "FREE",
  },
  PRO: {
    label: "Pro Plan",
    color: "text-violet-600 dark:text-violet-400",
    badge: "bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-400",
    badgeLabel: "PRO",
  },
  PROPLUS: {
    label: "Pro Plus Plan",
    color: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400",
    badgeLabel: "PRO PLUS",
  },
} as const;

function PlanCard({ config }: { config: PlanConfig }) {
  const qc = useQueryClient();
  const meta = PLAN_META[config.planCode];

  const [quota, setQuota] = useState(String(config.monthlySessionQuota));
  const [tests, setTests] = useState(String(config.testsPerSession));
  const [price, setPrice] = useState(String(config.monthlyPrice));
  const [trialDays, setTrialDays] = useState(String(config.trialDays));
  const [dirty, setDirty] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      updatePlanConfig({
        planCode: config.planCode,
        monthlySessionQuota: parseInt(quota),
        testsPerSession: parseInt(tests),
        monthlyPrice: parseInt(price),
        trialDays: parseInt(trialDays),
      }),
    onSuccess: () => {
      toast.success(`${meta.label} güncellendi`);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["admin", "plan-config"] });
    },
    onError: () => toast.error("Güncelleme başarısız"),
  });

  const mark = () => setDirty(true);

  const isValid =
    parseInt(quota) >= 1 &&
    parseInt(tests) >= 1 &&
    parseInt(price) >= 0 &&
    parseInt(trialDays) >= 0 &&
    !isNaN(parseInt(quota)) &&
    !isNaN(parseInt(tests)) &&
    !isNaN(parseInt(price)) &&
    !isNaN(parseInt(trialDays));

  const annualPrice = Math.round(parseInt(price) * 12 * 0.8);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className={`text-base ${meta.color}`}>{meta.label}</CardTitle>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.badge}`}>
            {meta.badgeLabel}
          </span>
        </div>
        <CardDescription className="text-xs">
          Son güncelleme:{" "}
          {config.updatedAt && config.updatedAt !== "1970-01-01T00:00:00.000Z"
            ? new Date(config.updatedAt).toLocaleDateString("tr-TR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Varsayılan değer"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Aylık Seans Hakkı</Label>
          <Input
            type="number"
            min={1}
            value={quota}
            onChange={(e) => { setQuota(e.target.value); mark(); }}
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">
            Yeni kayıtlar bu değeri alır. Mevcut aboneler etkilenmez.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Seans Başına Test Hakkı</Label>
          <Input
            type="number"
            min={1}
            value={tests}
            onChange={(e) => { setTests(e.target.value); mark(); }}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Aylık Fiyat (₺)</Label>
          <Input
            type="number"
            min={0}
            value={price}
            onChange={(e) => { setPrice(e.target.value); mark(); }}
            className="h-9"
          />
          {parseInt(price) > 0 && !isNaN(parseInt(price)) && (
            <p className="text-xs text-muted-foreground">
              Yıllık (%20 indirimli): ₺{annualPrice.toLocaleString("tr-TR")}
            </p>
          )}
        </div>
        {config.planCode === "FREE" && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Deneme Süresi (gün)</Label>
            <Input
              type="number"
              min={0}
              value={trialDays}
              onChange={(e) => { setTrialDays(e.target.value); mark(); }}
              className="h-9"
            />
          </div>
        )}
        <Button
          size="sm"
          className="w-full cursor-pointer"
          disabled={!dirty || !isValid || isPending}
          onClick={() => mutate()}
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          Kaydet
        </Button>
      </CardContent>
    </Card>
  );
}

export default function PlanConfigPage() {
  const { data: configs, isLoading } = useQuery({
    queryKey: ["admin", "plan-config"],
    queryFn: fetchPlanConfigs,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Plan Ayarları</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Her plan için seans kotası, fiyat ve deneme süresi ayarlarını yönetin.
        </p>
      </div>

      {/* Bilgi notu */}
      <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
        <Info className="size-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <p className="font-medium">Değişiklikler nasıl uygulanır?</p>
          <ul className="text-xs space-y-0.5 text-blue-600 dark:text-blue-400">
            <li>• Yeni kayıt olan kullanıcılar, kaydedilen değeri alır.</li>
            <li>• Mevcut aboneler kendi satın alma anındaki kotayı kullanmaya devam eder.</li>
            <li>• Plan yükseltmesi sırasında yeni değer uygulanır.</li>
            <li>• Fiyat değişikliği kayıt sayfasına anında yansır.</li>
            <li>• Yıllık fiyat, aylık × 12 × 0.80 olarak otomatik hesaplanır.</li>
          </ul>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-40">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {configs?.map((c) => <PlanCard key={c.planCode} config={c} />)}
        </div>
      )}
    </div>
  );
}
