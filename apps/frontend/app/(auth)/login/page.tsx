import Link from "next/link";
import { Logo } from "@/components/logo";
import {
  BookOpen,
  CalendarDays,
  ChartBar,
  FileText,
  LogIn,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

const features = [
  { icon: Users, text: "Danışan kaydı ve takibi" },
  { icon: CalendarDays, text: "Seans planlama ve randevu yönetimi" },
  { icon: FileText, text: "Dijital not ve belge arşivi" },
  { icon: ChartBar, text: "Gelir ve seans analizi" },
  { icon: BookOpen, text: "Psikolojik test uygulama ve raporlama" },
  { icon: ShieldCheck, text: "KVKK uyumlu güvenli altyapı" },
];

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* Sol — marka & özellikler */}
      <div className="hidden lg:flex lg:w-3/5 flex-col justify-between bg-primary p-12 text-primary-foreground">
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
      <div className="flex w-full lg:w-2/5 flex-col items-center justify-center bg-background p-8">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobil logo (lg'de gizli) */}
          <div className="lg:hidden">
            <Logo size="md" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Tekrar hoş geldiniz</h2>
            <p className="text-sm text-muted-foreground">
              Hesabınıza giriş yapın ya da yeni hesap oluşturun.
            </p>
          </div>

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
                className="group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-border bg-background px-4 py-6 text-center transition-all duration-200 hover:border-foreground hover:bg-foreground hover:text-background"
              >
                <LogIn className="size-6 text-muted-foreground transition-colors duration-200 group-hover:text-background" />
                <div>
                  <p className="text-sm font-semibold">Giriş Yap</p>
                  <p className="mt-0.5 text-xs text-muted-foreground transition-colors duration-200 group-hover:text-background/60">
                    Hesabın var mı?
                  </p>
                </div>
              </button>
            </form>
          </div>

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
