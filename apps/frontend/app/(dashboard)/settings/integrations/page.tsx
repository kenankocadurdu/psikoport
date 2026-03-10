"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  fetchIntegrations,
  fetchGoogleAuthUrl,
  fetchOutlookAuthUrl,
  disconnectIntegration,
  triggerSync,
  fetchVideoIntegrations,
  fetchZoomAuthUrl,
  disconnectVideoIntegration,
  type CalendarIntegrationItem,
  type VideoIntegrationItem,
} from "@/lib/api/calendar-integrations";
import { Calendar, Trash2, RefreshCw, Loader2, Video } from "lucide-react";

const PROVIDER_LABELS: Record<string, string> = {
  GOOGLE: "Google Calendar",
  MICROSOFT: "Outlook Takvim",
};

const VIDEO_PROVIDER_LABELS: Record<string, string> = {
  ZOOM: "Zoom",
  GOOGLE_MEET: "Google Meet",
};

export default function IntegrationsPage() {
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<CalendarIntegrationItem[]>([]);
  const [videoIntegrations, setVideoIntegrations] = useState<VideoIntegrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connectingOutlook, setConnectingOutlook] = useState(false);
  const [connectingZoom, setConnectingZoom] = useState(false);
  const [disconnectingVideoId, setDisconnectingVideoId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [calList, videoList] = await Promise.all([
          fetchIntegrations(),
          fetchVideoIntegrations(),
        ]);
        setIntegrations(calList);
        setVideoIntegrations(videoList);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Liste alınamadı");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const google = searchParams.get("google");
    const error = searchParams.get("error");
    if (google === "connected") {
      toast.success("Google Calendar başarıyla bağlandı.");
      fetchIntegrations().then(setIntegrations);
      window.history.replaceState({}, "", "/settings/integrations");
    }
    const outlook = searchParams.get("outlook");
    if (outlook === "connected") {
      toast.success("Outlook Takvim başarıyla bağlandı.");
      fetchIntegrations().then(setIntegrations);
      window.history.replaceState({}, "", "/settings/integrations");
    }
    const zoom = searchParams.get("zoom");
    if (zoom === "connected") {
      toast.success("Zoom başarıyla bağlandı.");
      fetchVideoIntegrations().then(setVideoIntegrations);
      window.history.replaceState({}, "", "/settings/integrations");
    }
    if (error) {
      const msg =
        error === "missing_params"
          ? "Eksik parametre."
          : error === "invalid_state"
            ? "Geçersiz veya süresi dolmuş oturum. Lütfen tekrar deneyin."
            : error === "exchange_failed"
              ? "Token alınamadı. Lütfen tekrar deneyin."
              : "Bir hata oluştu.";
      toast.error(msg);
      window.history.replaceState({}, "", "/settings/integrations");
    }
  }, [searchParams]);

  const handleConnectGoogle = async () => {
    setConnecting(true);
    try {
      const { url } = await fetchGoogleAuthUrl();
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bağlantı başlatılamadı");
      setConnecting(false);
    }
  };

  const handleConnectOutlook = async () => {
    setConnectingOutlook(true);
    try {
      const { url } = await fetchOutlookAuthUrl();
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bağlantı başlatılamadı");
      setConnectingOutlook(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    setDisconnectingId(id);
    try {
      await disconnectIntegration(id);
      setIntegrations((prev) => prev.filter((i) => i.id !== id));
      toast.success("Bağlantı kesildi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bağlantı kesilemedi");
    } finally {
      setDisconnectingId(null);
    }
  };

  const handleConnectZoom = async () => {
    setConnectingZoom(true);
    try {
      const { url } = await fetchZoomAuthUrl();
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bağlantı başlatılamadı");
      setConnectingZoom(false);
    }
  };

  const handleDisconnectVideo = async (id: string) => {
    setDisconnectingVideoId(id);
    try {
      await disconnectVideoIntegration(id);
      setVideoIntegrations((prev) => prev.filter((i) => i.id !== id));
      toast.success("Video bağlantısı kesildi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bağlantı kesilemedi");
    } finally {
      setDisconnectingVideoId(null);
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      await triggerSync(id);
      toast.success("Senkronizasyon başlatıldı.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Senkronizasyon tetiklenemedi");
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Entegrasyonlar</h1>
      <p className="text-muted-foreground mt-1">
        Takvim ve video sağlayıcılarınızı yönetin.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-medium mb-4">Takvim</h2>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Yükleniyor...
          </div>
        ) : (
          <div className="space-y-4">
            {integrations.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Henüz bağlı takvim yok.
              </p>
            ) : (
              <ul className="space-y-3">
                {integrations.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">
                          {PROVIDER_LABELS[i.provider] ?? i.provider}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {i.calendarId}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSync(i.id)}
                        disabled={syncingId === i.id}
                      >
                        {syncingId === i.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(i.id)}
                        disabled={disconnectingId === i.id}
                      >
                        {disconnectingId === i.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-2">
              {!integrations.some((i) => i.provider === "GOOGLE") && (
                <Button
                  onClick={handleConnectGoogle}
                  disabled={connecting}
                >
                  {connecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Yönlendiriliyor...
                    </>
                  ) : (
                    <>
                      <Calendar className="mr-2 h-4 w-4" />
                      Google Calendar Bağla
                    </>
                  )}
                </Button>
              )}
              {!integrations.some((i) => i.provider === "MICROSOFT") && (
                <Button
                  variant="outline"
                  onClick={handleConnectOutlook}
                  disabled={connectingOutlook}
                >
                  {connectingOutlook ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Yönlendiriliyor...
                    </>
                  ) : (
                    <>
                      <Calendar className="mr-2 h-4 w-4" />
                      Outlook Bağla
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium mb-4">Online Görüşme</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Yükleniyor...
          </div>
        ) : (
          <div className="space-y-4">
            {videoIntegrations.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Henüz video sağlayıcı bağlı değil.
              </p>
            ) : (
              <ul className="space-y-3">
                {videoIntegrations.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Video className="h-5 w-5 text-muted-foreground" />
                      <p className="font-medium">
                        {VIDEO_PROVIDER_LABELS[i.provider] ?? i.provider}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnectVideo(i.id)}
                      disabled={disconnectingVideoId === i.id}
                    >
                      {disconnectingVideoId === i.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {!videoIntegrations.some((i) => i.provider === "ZOOM") && (
              <Button
                variant="outline"
                onClick={handleConnectZoom}
                disabled={connectingZoom}
              >
                {connectingZoom ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Yönlendiriliyor...
                  </>
                ) : (
                  <>
                    <Video className="mr-2 h-4 w-4" />
                    Zoom Bağla
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
