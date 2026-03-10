"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchFiles,
  getUploadUrl,
  getDownloadUrl,
  deleteFile,
} from "@/lib/api/files";
import { downloadClientExport } from "@/lib/api/export";
import { Button } from "@/components/ui/button";
import { Download, Trash2, Upload, File } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";

interface FilesTabProps {
  clientId: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function FilesTab({ clientId }: FilesTabProps) {
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["files", clientId],
    queryFn: () => fetchFiles(clientId),
    enabled: !!clientId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const { url, fileId } = await getUploadUrl(clientId, {
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        fileSize: file.size,
      });
      const putRes = await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!putRes.ok) throw new Error("Yükleme başarısız");
      return fileId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", clientId] });
      toast.success("Dosya yüklendi.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => deleteFile(clientId, fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", clientId] });
      toast.success("Dosya silindi.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleDownload = async (fileId: string) => {
    try {
      const { url } = await getDownloadUrl(clientId, fileId);
      window.open(url, "_blank");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İndirme başarısız.");
    }
  };

  const handleExport = async (format: "json" | "csv") => {
    try {
      await downloadClientExport(clientId, format);
      toast.success(`${format.toUpperCase()} indirildi.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export başarısız.");
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-medium">Dosyalar</h2>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={onFileSelect}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            <Upload className="size-4" />
            Yükle
          </Button>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport("json")}
            >
              <Download className="size-4" />
              JSON
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport("csv")}
            >
              <Download className="size-4" />
              CSV
            </Button>
          </div>
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        Verileri İndir (KVKK): Danışan verilerini JSON veya CSV olarak indirin.
        Şifreli seans notu içerikleri dahil edilmez.
      </p>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <File className="mx-auto size-12 opacity-50" />
          <p className="mt-2">Henüz dosya yok.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => fileInputRef.current?.click()}
          >
            Dosya yükle
          </Button>
        </div>
      ) : (
        <ul className="divide-border divide-y rounded-lg border">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{f.fileName}</p>
                <p className="text-muted-foreground text-sm">
                  {formatBytes(f.fileSize)} ·{" "}
                  {format(new Date(f.createdAt), "d MMM yyyy", { locale: tr })}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(f.id)}
                >
                  <Download className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(f.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
