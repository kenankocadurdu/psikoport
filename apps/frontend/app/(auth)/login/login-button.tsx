import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";

/**
 * Form submit kullanıyoruz; böylece Next.js prefetch yapmaz ve
 * Auth0 yönlendirmesinde CORS hatası oluşmaz.
 */
export function LoginButton() {
  return (
    <form action="/api/auth/go-login" method="get" className="block">
      <Button variant="outline" className="w-full" size="lg" type="submit">
        <LogIn className="size-4" />
        Giriş Yap
      </Button>
    </form>
  );
}
