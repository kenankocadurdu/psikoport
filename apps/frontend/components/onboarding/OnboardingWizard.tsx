"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createClient,
  fetchClients,
} from "@/lib/api/clients";
import {
  fetchAppointmentsCalendar,
} from "@/lib/api/appointments";
import {
  fetchMe,
} from "@/lib/api/auth";
import {
  fetchFormDefinitions,
} from "@/lib/api/form-definitions";
import {
  generateFormLink,
} from "@/lib/api/form-submissions";
import {
  createAppointment,
} from "@/lib/api/appointments";
import { toast } from "sonner";
import {
  Users,
  Calendar,
  ClipboardList,
  Check,
  Loader2,
  Sparkles,
} from "lucide-react";

const ONBOARDING_STORAGE_KEY = "psikoport_onboarding_v1";

type OnboardingStatus = "active" | "completed" | "skipped";

function getOnboardingStatus(): OnboardingStatus {
  if (typeof window === "undefined") return "active";
  const v = localStorage.getItem(ONBOARDING_STORAGE_KEY);
  if (v === "completed" || v === "skipped") return v;
  return "active";
}

function setOnboardingCompleted() {
  if (typeof window !== "undefined") {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "completed");
  }
}

function setOnboardingSkipped() {
  if (typeof window !== "undefined") {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "skipped");
  }
}

function fireConfetti() {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.7 },
  });
}

const DEMO_CLIENT = {
  firstName: "Demo",
  lastName: "Danışan",
  email: "demo@example.com",
  phone: "0532 000 00 01",
  complaintAreas: ["anksiyete"],
};

export function OnboardingWizard() {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(1);
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [clientId, setClientId] = React.useState("");
  const [formDefId, setFormDefId] = React.useState("");
  const [apptClientId, setApptClientId] = React.useState("");
  const [apptDate, setApptDate] = React.useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [apptTime, setApptTime] = React.useState("10:00");

  React.useEffect(() => {
    setOpen(getOnboardingStatus() === "active");
  }, []);

  const { data: clientsData } = useQuery({
    queryKey: ["clients", { limit: 100 }],
    queryFn: () => fetchClients({ limit: 100 }),
    enabled: open,
  });

  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setFullYear(rangeStart.getFullYear() - 1);
  const rangeEnd = new Date(now);
  rangeEnd.setFullYear(rangeEnd.getFullYear() + 1);

  const { data: apptsData } = useQuery({
    queryKey: ["appointments", "calendar", rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: () =>
      fetchAppointmentsCalendar({
        start: rangeStart.toISOString(),
        end: rangeEnd.toISOString(),
      }),
    enabled: open,
  });

  const clients = clientsData?.data ?? [];
  const appts = apptsData?.data ?? [];
  const hasClient = clients.length >= 1;
  const hasAppointment = appts.length >= 1;

  // Initial step when data already exists (e.g. demo tenant)
  React.useEffect(() => {
    if (!open || !clientsData || !apptsData) return;
    if (hasAppointment && step < 3) setStep(3);
    else if (hasClient && step < 2) setStep(2);
  }, [open, clientsData, apptsData, hasClient, hasAppointment]);

  const { data: me } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    enabled: open,
  });

  const { data: formsData } = useQuery({
    queryKey: ["form-definitions", "PSYCHOMETRIC"],
    queryFn: () => fetchFormDefinitions({ formType: "PSYCHOMETRIC", limit: 50 }),
    enabled: open && step === 3,
  });

  const forms = formsData?.data ?? [];

  const createClientMutation = useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      fireConfetti();
      toast.success("Danışan eklendi! ✓");
      setStep(2);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createAppointmentMutation = useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      fireConfetti();
      toast.success("Randevu oluşturuldu! ✓");
      setStep(3);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const generateLinkMutation = useMutation({
    mutationFn: ({ clientId, formDefId }: { clientId: string; formDefId: string }) =>
      generateFormLink(clientId, formDefId),
    onSuccess: (res) => {
      navigator.clipboard.writeText(res.url);
      fireConfetti();
      toast.success("Test linki kopyalandı! ✓");
      setOnboardingCompleted();
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Ad ve soyad zorunludur");
      return;
    }
    createClientMutation.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    });
  };

  const handleDemoClient = () => {
    createClientMutation.mutate(DEMO_CLIENT);
  };

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!me || !apptClientId) return;
    const start = new Date(`${apptDate}T${apptTime}`);
    const end = new Date(start.getTime() + 50 * 60 * 1000);
    createAppointmentMutation.mutate({
      clientId: apptClientId,
      psychologistId: me.id,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationMinutes: 50,
      locationType: "ONLINE",
    });
  };

  const handleSendTest = () => {
    if (!clientId || !formDefId) {
      toast.error("Danışan ve test seçin");
      return;
    }
    generateLinkMutation.mutate({ clientId, formDefId });
  };

  const handleSkip = () => {
    setOnboardingSkipped();
    setOpen(false);
  };

  const handleClose = () => {
    setOpen(false);
    setOnboardingSkipped();
  };

  if (!open) return null;

  const steps = [
    {
      id: 1,
      icon: Users,
      title: "İlk danışanınızı ekleyin",
      done: hasClient,
    },
    {
      id: 2,
      icon: Calendar,
      title: "İlk randevunuzu oluşturun",
      done: hasAppointment,
    },
    {
      id: 3,
      icon: ClipboardList,
      title: "İlk testi gönderin",
      done: false,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-amber-500" />
            Hoş geldiniz! Hızlı Başlangıç
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Platformu keşfetmek için bu 3 adımı tamamlayın (~15 dakika).
        </p>

        {/* Step indicators */}
        <div className="flex items-center gap-2">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <React.Fragment key={s.id}>
                <div
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${
                    step === s.id
                      ? "bg-primary text-primary-foreground"
                      : s.done
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.done ? <Check className="size-4" /> : <Icon className="size-4" />}
                  <span className="hidden sm:inline">{s.title}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className="h-0.5 flex-1 bg-border" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="min-h-[200px] space-y-4">
          {/* Step 1 */}
          {step === 1 && (
            <div>
              <h3 className="font-medium mb-3">Danışan ekleyin</h3>
              <form onSubmit={handleAddClient} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Ad</Label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Ad"
                      required
                    />
                  </div>
                  <div>
                    <Label>Soyad</Label>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Soyad"
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={createClientMutation.isPending}
                  >
                    {createClientMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Ekle"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDemoClient}
                    disabled={createClientMutation.isPending}
                  >
                    1 tıkla demo danışan
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div>
              <h3 className="font-medium mb-3">Randevu oluşturun</h3>
              <form onSubmit={handleCreateAppointment} className="space-y-3">
                <div>
                  <Label>Danışan</Label>
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={apptClientId}
                    onChange={(e) => setApptClientId(e.target.value)}
                    required
                  >
                    <option value="">— Seçin —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tarih</Label>
                    <Input
                      type="date"
                      value={apptDate}
                      onChange={(e) => setApptDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Saat</Label>
                    <Input
                      type="time"
                      value={apptTime}
                      onChange={(e) => setApptTime(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={
                    createAppointmentMutation.isPending ||
                    !apptClientId ||
                    clients.length === 0
                  }
                >
                  {createAppointmentMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Randevu Oluştur"
                  )}
                </Button>
              </form>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div>
              <h3 className="font-medium mb-3">Test linki gönderin</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Danışan seçip test türünü belirleyin. Link panoya kopyalanacak.
              </p>
              <div className="space-y-3">
                <div>
                  <Label>Danışan</Label>
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                  >
                    <option value="">— Seçin —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Test</Label>
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formDefId}
                    onChange={(e) => setFormDefId(e.target.value)}
                  >
                    <option value="">— Seçin —</option>
                    {forms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.title} ({f.code})
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  onClick={handleSendTest}
                  disabled={
                    generateLinkMutation.isPending || !clientId || !formDefId
                  }
                >
                  {generateLinkMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Link Oluştur ve Kopyala"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
            Atla
          </Button>
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                Geri
              </Button>
            )}
            {step < 3 && (step === 1 ? hasClient : hasAppointment) && (
              <Button onClick={() => setStep((s) => s + 1)}>
                İleri
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
