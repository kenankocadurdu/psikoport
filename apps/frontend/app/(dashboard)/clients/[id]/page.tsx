"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchClient, updateClient, type Client } from "@/lib/api/clients";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, User, FileText, ClipboardList, Calendar, Wallet, FolderOpen } from "lucide-react";

const NotesTab = dynamic(
  () => import("@/components/notes/NotesTab").then((m) => m.NotesTab),
  { ssr: false }
);

const ConsultationTimeline = dynamic(
  () => import("@/components/timeline/ConsultationTimeline").then((m) => m.ConsultationTimeline),
  { ssr: false }
);

import { TestsTab } from "@/components/tests/TestsTab";
import { FilesTab } from "@/components/files/FilesTab";
import { ClientAppointmentsTab } from "@/components/appointments/ClientAppointmentsTab";
import { ClientPaymentsTab } from "@/components/finance/ClientPaymentsTab";

export default function ClientDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const tabParam = searchParams.get("tab");
  const newNoteParam = searchParams.get("newNote");
  const [activeTab, setActiveTab] = React.useState(tabParam ?? "profil");

  const { data: client, isLoading, isError } = useQuery({
    queryKey: ["client", id],
    queryFn: () => fetchClient(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isError || !client) {
    return (
      <div className="space-y-4">
        <Link href="/clients">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" />
            Danışanlara dön
          </Button>
        </Link>
        <p className="text-destructive">Danışan bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/clients">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">
              {client.firstName} {client.lastName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {client.email ?? client.phone ?? "İletişim bilgisi yok"}
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="profil">
            <User className="size-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="notlar">
            <FileText className="size-4" />
            Seans Notları
          </TabsTrigger>
          <TabsTrigger value="testler">
            <ClipboardList className="size-4" />
            Testler
          </TabsTrigger>
          <TabsTrigger value="randevular">
            <Calendar className="size-4" />
            Randevular
          </TabsTrigger>
          <TabsTrigger value="odemeler">
            <Wallet className="size-4" />
            Ödemeler
          </TabsTrigger>
          <TabsTrigger value="dosyalar">
            <FolderOpen className="size-4" />
            Dosyalar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profil" className="mt-6">
          <div className="space-y-8">
            <ClientProfileForm client={client} clientId={client.id} />
            <section>
              <h2 className="mb-4 text-lg font-medium">Zaman Çizelgesi</h2>
              <ConsultationTimeline clientId={client.id} />
            </section>
          </div>
        </TabsContent>
        <TabsContent value="notlar" className="mt-6">
          <NotesTab clientId={client.id} autoOpen={newNoteParam === "1"} />
        </TabsContent>
        <TabsContent value="testler" className="mt-6">
          <TestsTab clientId={client.id} />
        </TabsContent>
        <TabsContent value="randevular" className="mt-6">
          <ClientAppointmentsTab
            clientId={client.id}
            clientName={`${client.firstName} ${client.lastName}`}
          />
        </TabsContent>
        <TabsContent value="odemeler" className="mt-6">
          <ClientPaymentsTab clientId={client.id} />
        </TabsContent>
        <TabsContent value="dosyalar" className="mt-6">
          <FilesTab clientId={client.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlaceholderTab({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
      <p>{title} modülü yakında eklenecek.</p>
    </div>
  );
}

function ClientProfileForm({
  client,
  clientId,
}: {
  client: Client;
  clientId: string;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: Parameters<typeof updateClient>[1]) =>
      updateClient(clientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      toast.success("Profil güncellendi");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = {
      firstName: (form.elements.namedItem("firstName") as HTMLInputElement).value,
      lastName: (form.elements.namedItem("lastName") as HTMLInputElement).value,
      phone: (form.elements.namedItem("phone") as HTMLInputElement).value || undefined,
      email: (form.elements.namedItem("email") as HTMLInputElement).value || undefined,
      birthDate: (form.elements.namedItem("birthDate") as HTMLInputElement).value || undefined,
      gender: (form.elements.namedItem("gender") as HTMLInputElement).value || undefined,
      address: (form.elements.namedItem("address") as HTMLInputElement).value || undefined,
    };
    mutation.mutate(data);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl space-y-6 rounded-lg border p-6"
    >
      <h2 className="text-lg font-medium">Kişisel Bilgiler</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">Ad</Label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={client.firstName}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Soyad</Label>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={client.lastName}
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="phone">Telefon</Label>
          <Input id="phone" name="phone" defaultValue={client.phone ?? ""} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="email">E-posta</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={client.email ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="birthDate">Doğum Tarihi</Label>
          <Input
            id="birthDate"
            name="birthDate"
            type="date"
            defaultValue={
              client.birthDate
                ? client.birthDate.split("T")[0]
                : ""
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gender">Cinsiyet</Label>
          <Input id="gender" name="gender" defaultValue={client.gender ?? ""} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">Adres</Label>
          <Input
            id="address"
            name="address"
            defaultValue={client.address ?? ""}
          />
        </div>
      </div>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Kaydediliyor..." : "Kaydet"}
      </Button>
    </form>
  );
}
