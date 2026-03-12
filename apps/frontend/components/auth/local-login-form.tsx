"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn, Loader2, Sparkles } from "lucide-react";

export function LocalLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/local-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json()) as {
        access_token?: string;
        error?: { message?: string };
        message?: string;
      };

      if (!res.ok) {
        setError(data?.error?.message ?? data?.message ?? "Giriş başarısız");
        return;
      }

      if (data.access_token) {
        localStorage.setItem("access_token", data.access_token);
        sessionStorage.setItem("access_token", data.access_token);
      }

      router.replace("/");
    } catch {
      setError("Sunucuya bağlanılamadı. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1.5">
            E-posta
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-primary focus:ring-offset-2 placeholder:text-muted-foreground"
            placeholder="ornek@email.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1.5">
            Şifre
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-primary focus:ring-offset-2 placeholder:text-muted-foreground"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogIn className="size-4" />
          )}
          Giriş Yap
        </button>
      </form>

      <div className="flex items-center justify-center">
        <Link
          href="/register"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Sparkles className="size-3.5" />
          Hesabınız yok mu? Ücretsiz başlayın
        </Link>
      </div>
    </div>
  );
}
