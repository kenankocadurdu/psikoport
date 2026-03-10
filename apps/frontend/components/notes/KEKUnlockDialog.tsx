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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deriveKEK } from "@/lib/crypto/argon2";
import { setKEK } from "@/lib/crypto/key-store";
import { getKekSalt } from "@/lib/crypto/kek-salt";

interface KEKUnlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function KEKUnlockDialog({
  open,
  onOpenChange,
  onSuccess,
}: KEKUnlockDialogProps) {
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const salt = getKekSalt();
    if (!salt) {
      setError("Şifreleme anahtarı yapılandırılmamış. NEXT_PUBLIC_KEK_SALT_B64 ortam değişkenini ayarlayın.");
      setLoading(false);
      return;
    }

    try {
      const kek = await deriveKEK(password, salt);
      setKEK(kek);
      setPassword("");
      onSuccess();
      onOpenChange(false);
    } catch {
      setError("Şifre geçersiz veya türetme hatası.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>Şifre çözme parolası</DialogTitle>
          <DialogDescription>
            Seans notlarını görüntülemek için lütfen şifre çözme parolanızı girin.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kek-password">Parola</Label>
            <Input
              id="kek-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
              aria-invalid={!!error}
            />
            {error && (
              <p className="text-destructive text-sm">{error}</p>
            )}
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
            <Button type="submit" disabled={loading || !password}>
              {loading ? "Açılıyor..." : "Aç"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
