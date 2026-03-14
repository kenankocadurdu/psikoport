"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { TagAutocomplete } from "./TagAutocomplete";
import { createNote, type CreateNotePayload } from "@/lib/api/notes";
import { toast } from "sonner";
import { format } from "date-fns";

const SESSION_TYPES = [
  "Bireysel",
  "Çift",
  "Aile",
  "Grup",
  "Online",
  "Yüz yüze",
] as const;

interface CreateNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onSuccess: () => void;
}

export function CreateNoteDialog({
  open,
  onOpenChange,
  clientId,
  onSuccess,
}: CreateNoteDialogProps) {
  const [content, setContent] = React.useState("");
  const [sessionDate, setSessionDate] = React.useState(() =>
    format(new Date(), "yyyy-MM-dd")
  );
  const [sessionNumber, setSessionNumber] = React.useState("");
  const [sessionType, setSessionType] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [moodRating, setMoodRating] = React.useState<number>(5);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: CreateNotePayload = {
        sessionDate,
        sessionNumber: sessionNumber ? parseInt(sessionNumber, 10) : undefined,
        sessionType: sessionType || undefined,
        tags: tags.length ? tags : undefined,
        symptomCategories: tags.length ? tags : undefined,
        moodRating,
        content,
      };
      await createNote(clientId, payload);
      toast.success("Not kaydedildi.");
      setContent("");
      setSessionNumber("");
      setSessionType("");
      setTags([]);
      setMoodRating(5);
      setSessionDate(format(new Date(), "yyyy-MM-dd"));
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Not kaydedilemedi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Yeni Seans Notu</DialogTitle>
          <DialogDescription>
            Not içeriği sunucu tarafında şifrelenerek kaydedilir.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="content">Not içeriği</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Seans notu..."
                  rows={12}
                  className="resize-none"
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sessionDate">Tarih</Label>
                <Input
                  id="sessionDate"
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sessionNumber">Seans no</Label>
                <Input
                  id="sessionNumber"
                  type="number"
                  min={1}
                  value={sessionNumber}
                  onChange={(e) => setSessionNumber(e.target.value)}
                  placeholder="Opsiyonel"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sessionType">Seans tipi</Label>
                <select
                  id="sessionType"
                  value={sessionType}
                  onChange={(e) => setSessionType(e.target.value)}
                  className="border-input h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2"
                >
                  <option value="">Seçin</option>
                  {SESSION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Etiketler</Label>
                <TagAutocomplete value={tags} onChange={setTags} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mood">Mood (1–10)</Label>
                  <span className="text-muted-foreground text-sm">{moodRating}</span>
                </div>
                <Slider
                  id="mood"
                  min={1}
                  max={10}
                  step={1}
                  value={[moodRating]}
                  onValueChange={([v]) => setMoodRating(v ?? 5)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              İptal
            </Button>
            <Button type="submit" disabled={loading || !content.trim()}>
              {loading ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
