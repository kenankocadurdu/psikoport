"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { fetchFormDefinitions } from "@/lib/api/form-definitions";
import { generateFormLink } from "@/lib/api/form-submissions";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface SendTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onSuccess?: () => void;
}

export function SendTestDialog({
  open,
  onOpenChange,
  clientId,
  onSuccess,
}: SendTestDialogProps) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["form-definitions", "PSYCHOMETRIC"],
    queryFn: () =>
      fetchFormDefinitions({ formType: "PSYCHOMETRIC", limit: 50 }),
    enabled: open,
  });

  const generateMutation = useMutation({
    mutationFn: (formDefinitionId: string) =>
      generateFormLink(clientId, formDefinitionId),
    onSuccess: (res) => {
      navigator.clipboard.writeText(res.url);
      toast.success(
        "Form linki kopyalandı. Danışana SMS/e-posta ile gönderebilirsiniz."
      );
      queryClient.invalidateQueries({
        queryKey: ["form-submissions", clientId],
      });
      onSuccess?.();
      onOpenChange(false);
      setSelectedId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const forms = data?.data ?? [];

  const handleSend = () => {
    if (!selectedId) {
      toast.error("Lütfen bir test seçin.");
      return;
    }
    generateMutation.mutate(selectedId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Test Gönder</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Test Seçin</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value || null)}
              disabled={isLoading}
            >
              <option value="">— Test seçin —</option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title} ({f.code})
                </option>
              ))}
            </select>
          </div>
          <p className="text-muted-foreground text-xs">
            Form linki oluşturulup panoya kopyalanacak. Linki danışana SMS veya
            e-posta ile gönderebilirsiniz.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button
            onClick={handleSend}
            disabled={!selectedId || generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Link Oluştur ve Kopyala"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
