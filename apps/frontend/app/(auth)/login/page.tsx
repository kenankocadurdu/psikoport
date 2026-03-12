import Link from "next/link";
import { Logo } from "@/components/logo";
import {
  BookOpen,
  CalendarDays,
  ChartBar,
  FileText,
  ShieldCheck,
  Sparkles,
  Users,
  LogIn,
} from "lucide-react";
import { LocalLoginForm } from "@/components/auth/local-login-form";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const features = [
  { icon: Users, text: "Danışan kaydı ve takibi" },
  { icon: CalendarDays, text: "Seans planlama ve randevu yönetimi" },
  { icon: FileText, text: "Dijital not ve belge arşivi" },
  { icon: ChartBar, text: "Gelir ve seans analizi" },
  { icon: BookOpen, text: "Psikolojik test uygulama ve raporlama" },
  { icon: ShieldCheck, text: "KVKK uyumlu güvenli altyapı" },
];

async function getAuthConfig(): Promise<{ useAuth0: boolean }> {
  try {
    const res = await fetch(`${API_URL}/auth/config`, { cache: "no-store" });
    return res.ok ? res.json() : { useAuth0: true };
  } catch {
    return { useAuth0: true };
  }
}

export default async function LoginPage() {
  const { useAuth0 } = await getAuthConfig();

  return (
    <div className="fixed inset-0 flex">
      {/* Sol — marka & özellikler */}
      <div className="hidden lg:flex lg:w-3/5 flex-col justify-between bg-primary p-12 text-primary-foreground overflow-y-auto">
        <div>
          <div className="mb-16">
            <Logo size="lg" variant="white" />
          </div>

          <div className="space-y-4 mb-12">
            <h1 className="text-4xl font-bold leading-tight">
              Danışmanlık pratiğinizi<br />
              dijital dünyaya taşıyın.
            </h1>
            <p className="text-primary-foreground/75 text-lg leading-relaxed">
              Psikolog, psikolojik danışman ve rehberlik uzmanları için
              tasarlanmış kapsamlı yönetim platformu.
            </p>
          </div>

          <ul className="space-y-4">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10">
                  <Icon className="size-4" />
                </div>
                <span className="text-primary-foreground/90 text-sm">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-primary-foreground/40 text-xs">
          © {new Date().getFullYear()} Psikoport. Tüm hakları saklıdır.
        </p>
      </div>

      {/* Sağ — giriş kartı */}
      <div className="flex w-full lg:w-2/5 flex-col items-center justify-start pt-14 lg:justify-center lg:pt-0 bg-background p-8 overflow-y-auto">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobil logo (lg'de gizli) */}
          <div className="lg:hidden flex items-center gap-2">
            <Logo size="md" iconOnly />
            <span className="text-xl font-extrabold tracking-tight">
              Psikoport<span className="inline-block size-1.5 rounded-full bg-rose-500 ml-0.5 mb-2" />
            </span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Hoş geldiniz</h2>
            <p className="text-sm text-muted-foreground">
              Hesabınıza giriş yapın ya da yeni hesap oluşturun.
            </p>
          </div>

          {useAuth0 ? (
            /* Auth0 modu */
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/register"
                className="group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-border bg-background px-4 py-6 text-center transition-all duration-200 hover:border-primary hover:bg-primary hover:text-primary-foreground"
              >
                <Sparkles className="size-6 text-primary transition-colors duration-200 group-hover:text-primary-foreground" />
                <div>
                  <p className="text-sm font-semibold">Ücretsiz Başla</p>
                  <p className="mt-0.5 text-xs text-muted-foreground transition-colors duration-200 group-hover:text-primary-foreground/70">
                    Hesap oluştur
                  </p>
                </div>
              </Link>

              <form action="/api/auth/go-login" method="get" className="contents">
                <button
                  type="submit"
                  className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-border bg-background px-4 py-6 text-center transition-all duration-200 hover:border-secondary hover:bg-secondary hover:text-secondary-foreground"
                >
                  <LogIn className="size-6 text-muted-foreground transition-colors duration-200 group-hover:text-secondary-foreground" />
                  <div>
                    <p className="text-sm font-semibold">Giriş Yap</p>
                    <p className="mt-0.5 text-xs text-muted-foreground transition-colors duration-200 group-hover:text-secondary-foreground/70">
                      Hesabın var mı?
                    </p>
                  </div>
                </button>
              </form>
            </div>
          ) : (
            /* Local mod — e-posta/şifre formu */
            <LocalLoginForm />
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-3 text-muted-foreground">
                Güvenli giriş
              </span>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground leading-relaxed">
            Giriş yaparak{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
              kullanım koşullarını
            </Link>{" "}
            ve{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              gizlilik politikasını
            </Link>{" "}
            kabul etmiş olursunuz.
          </p>
        </div>
      </div>
    </div>
  );
}
