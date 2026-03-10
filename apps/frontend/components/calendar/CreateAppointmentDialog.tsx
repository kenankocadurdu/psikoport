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
import { Input } from "@/components/ui/input";
import { fetchClients, createClient } from "@/lib/api/clients";
import { fetchMe } from "@/lib/api/auth";
import { createAppointment } from "@/lib/api/appointments";
import { toast } from "sonner";
import { Loader2, UserPlus, X } from "lucide-react";

interface CreateAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  defaultClientId?: string;
  defaultClientName?: string;
  onSuccess?: () => void;
}

export function CreateAppointmentDialog({
  open,
  onOpenChange,
  defaultDate,
  defaultClientId,
  defaultClientName,
  onSuccess,
}: CreateAppointmentDialogProps) {
  const queryClient = useQueryClient();

  const [clientId, setClientId] = React.useState("");
  const [selectedClientName, setSelectedClientName] = React.useState("");
  const [isNewClient, setIsNewClient] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showResults, setShowResults] = React.useState(false);
  const [dateStr, setDateStr] = React.useState("");
  const [timeStr, setTimeStr] = React.useState("09:00");
  const [duration, setDuration] = React.useState(50);
  const [sessionType, setSessionType] = React.useState("");
  const [locationType, setLocationType] = React.useState<"IN_PERSON" | "ONLINE">("IN_PERSON");

  // Reset form each time dialog opens
  React.useEffect(() => {
    if (open) {
      const d = defaultDate ?? new Date();
      setDateStr(d.toISOString().slice(0, 10));
      setTimeStr(`${String(d.getHours()).padStart(2, "0")}:00`);
      setClientId(defaultClientId ?? "");
      setSelectedClientName(defaultClientName ?? "");
      setIsNewClient(false);
      setSearchQuery("");
      setShowResults(false);
      setDuration(50);
      setSessionType("");
      setLocationType("IN_PERSON");
    }
  }, [open, defaultDate, defaultClientId, defaultClientName]);

  const { data: me } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    enabled: open,
  });

  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ["clients", "search", searchQuery],
    queryFn: () => fetchClients({ search: searchQuery, limit: 10 }),
    enabled: open && searchQuery.trim().length >= 3,
  });

  const createMutation = useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Randevu oluşturuldu");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!me) return;

    const start = new Date(`${dateStr}T${timeStr}`);
    const end = new Date(start.getTime() + duration * 60 * 1000);

    let resolvedClientId = clientId;

    if (isNewClient) {
      const parts = selectedClientName.trim().split(/\s+/);
      const firstName = parts.length >= 2 ? parts.slice(0, -1).join(" ") : parts[0];
      const lastName = parts.length >= 2 ? parts[parts.length - 1] : "-";
      try {
        const newClient = await createClient({ firstName, lastName });
        resolvedClientId = newClient.id;
        toast.success(`${firstName} ${lastName} danışan olarak eklendi`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Danışan oluşturulamadı");
        return;
      }
    }

    if (!resolvedClientId) return;

    createMutation.mutate({
      clientId: resolvedClientId,
      psychologistId: me.id,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationMinutes: duration,
      sessionType: sessionType || undefined,
      locationType,
    });
  };

  const handleSelectClient = (id: string, name: string) => {
    setClientId(id);
    setSelectedClientName(name);
    setIsNewClient(false);
    setSearchQuery("");
    setShowResults(false);
  };

  const handleSelectNewClient = (name: string) => {
    setClientId("");
    setSelectedClientName(name);
    setIsNewClient(true);
    setSearchQuery("");
    setShowResults(false);
  };

  const handleClearClient = () => {
    setClientId("");
    setSelectedClientName("");
    setIsNewClient(false);
    setSearchQuery("");
  };

  const results = searchResults?.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Randevu</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Danışan arama */}
          <div>
            <Label htmlFor="client-search">Danışan</Label>
            {selectedClientName ? (
              <div className="mt-1 flex items-center gap-2 rounded-md border border-input bg-muted px-3 py-2 text-sm">
                {isNewClient && <UserPlus className="size-4 shrink-0 text-muted-foreground" />}
                <span className="flex-1">
                  {selectedClientName}
                  {isNewClient && <span className="ml-2 text-xs text-muted-foreground">(yeni danışan)</span>}
                </span>
                <button
                  type="button"
                  onClick={handleClearClient}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div className="relative mt-1">
                <Input
                  id="client-search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowResults(true);
                  }}
                  onFocus={() => searchQuery.trim().length >= 3 && setShowResults(true)}
                  onBlur={() => setTimeout(() => setShowResults(false), 150)}
                  placeholder="İsim veya soyisim girin (en az 3 karakter)"
                  autoComplete="off"
                />
                {showResults && searchQuery.trim().length >= 3 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                    {isSearching ? (
                      <div className="flex items-center justify-center py-3">
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <>
                        {results.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectClient(c.id, `${c.firstName} ${c.lastName}`);
                            }}
                          >
                            {c.firstName} {c.lastName}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 text-primary hover:bg-accent hover:text-accent-foreground transition-colors border-t"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectNewClient(searchQuery.trim());
                          }}
                        >
                          <UserPlus className="size-4 shrink-0" />
                          <span>&quot;{searchQuery.trim()}&quot; yeni danışan olarak ekle</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Tarih</Label>
              <Input
                id="date"
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="time">Saat</Label>
              <Input
                id="time"
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="mt-1"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="duration">Süre (dk)</Label>
            <select
              id="duration"
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              <option value={30}>30 dakika</option>
              <option value={45}>45 dakika</option>
              <option value={50}>50 dakika</option>
              <option value={60}>60 dakika</option>
              <option value={90}>90 dakika</option>
            </select>
          </div>

          <div>
            <Label htmlFor="location">Lokasyon</Label>
            <select
              id="location"
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={locationType}
              onChange={(e) => setLocationType(e.target.value as "IN_PERSON" | "ONLINE")}
            >
              <option value="IN_PERSON">Yüz yüze</option>
              <option value="ONLINE">Online</option>
            </select>
          </div>

          <div>
            <Label htmlFor="sessionType">Seans tipi (opsiyonel)</Label>
            <Input
              id="sessionType"
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value)}
              placeholder="Örn. Bireysel"
              className="mt-1"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !selectedClientName}>
              {createMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Oluştur"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
