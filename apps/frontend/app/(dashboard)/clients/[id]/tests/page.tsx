"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchClient } from "@/lib/api/clients";
import { Button } from "@/components/ui/button";
import { TestsTab } from "@/components/tests/TestsTab";
import { ArrowLeft } from "lucide-react";

export default function ClientTestsPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: () => fetchClient(id),
    enabled: !!id,
  });

  if (isLoading || !client) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/clients/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">
            {client.firstName} {client.lastName} — Testler
          </h1>
          <p className="text-muted-foreground text-sm">
            Danışana gönderilmiş testler ve sonuçları
          </p>
        </div>
      </div>
      <TestsTab clientId={id} />
    </div>
  );
}
