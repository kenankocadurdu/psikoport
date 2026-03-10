"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/api/clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";

const createClientSchema = z.object({
  firstName: z.string().min(1, "Ad zorunludur").max(100),
  lastName: z.string().min(1, "Soyad zorunludur").max(100),
  tcKimlik: z.string().max(11).optional(),
  birthDate: z.string().optional(),
  gender: z.string().max(50).optional(),
  maritalStatus: z.string().max(50).optional(),
  phone: z.string().max(20).optional(),
  email: z
    .string()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Geçerli bir e-posta girin"),
  address: z.string().max(500).optional(),
  referralSource: z.string().max(100).optional(),
});

type CreateClientForm = z.infer<typeof createClientSchema>;

export default function NewClientPage() {
  const router = useRouter();

  const form = useForm<CreateClientForm>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      tcKimlik: "",
      birthDate: "",
      gender: "",
      maritalStatus: "",
      phone: "",
      email: "",
      address: "",
      referralSource: "",
    },
  });

  const mutation = useMutation({
    mutationFn: createClient,
    onSuccess: (data) => {
      toast.success("Danışan başarıyla oluşturuldu");
      router.push(`/clients/${data.id}`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    mutation.mutate({
      firstName: values.firstName,
      lastName: values.lastName,
      tcKimlik: values.tcKimlik || undefined,
      birthDate: values.birthDate || undefined,
      gender: values.gender || undefined,
      maritalStatus: values.maritalStatus || undefined,
      phone: values.phone || undefined,
      email: values.email || undefined,
      address: values.address || undefined,
      referralSource: values.referralSource || undefined,
    });
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/clients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold">Yeni Danışan</h1>
      </div>

      <form onSubmit={onSubmit} className="max-w-2xl space-y-6 rounded-lg border p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">Ad *</Label>
            <Input
              id="firstName"
              {...form.register("firstName")}
              className={form.formState.errors.firstName ? "border-destructive" : ""}
            />
            {form.formState.errors.firstName && (
              <p className="text-sm text-destructive">
                {form.formState.errors.firstName.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Soyad *</Label>
            <Input
              id="lastName"
              {...form.register("lastName")}
              className={form.formState.errors.lastName ? "border-destructive" : ""}
            />
            {form.formState.errors.lastName && (
              <p className="text-sm text-destructive">
                {form.formState.errors.lastName.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" {...form.register("phone")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input
              id="email"
              type="email"
              {...form.register("email")}
              className={form.formState.errors.email ? "border-destructive" : ""}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="birthDate">Doğum Tarihi</Label>
            <Input id="birthDate" type="date" {...form.register("birthDate")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Cinsiyet</Label>
            <Input id="gender" {...form.register("gender")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maritalStatus">Medeni Durum</Label>
            <Input id="maritalStatus" {...form.register("maritalStatus")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="referralSource">Yönlendirme Kaynağı</Label>
            <Input id="referralSource" {...form.register("referralSource")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Adres</Label>
            <Input id="address" {...form.register("address")} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Kaydediliyor..." : "Kaydet"}
          </Button>
          <Link href="/clients">
            <Button type="button" variant="outline">
              İptal
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
