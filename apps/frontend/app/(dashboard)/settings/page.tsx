import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Ayarlar</h1>
      <p className="text-muted-foreground mt-2">Hesap ve entegrasyon ayarlarınız.</p>

      <div className="mt-8 space-y-4">
        <Link href="/settings/integrations">
          <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4">
            <Calendar className="h-5 w-5" />
            <div className="text-left">
              <p className="font-medium">Entegrasyonlar</p>
              <p className="text-sm text-muted-foreground font-normal">
                Google Calendar, Outlook, Zoom
              </p>
            </div>
          </Button>
        </Link>
      </div>
    </div>
  );
}
