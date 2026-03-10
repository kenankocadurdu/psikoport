"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { importClients, type ImportClientRow } from "@/lib/api/clients";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Upload, FileSpreadsheet, Loader2 } from "lucide-react";

const EXPECTED_COLUMNS = [
  { key: "firstName", labels: ["ad", "firstname", "first_name", "isim"] },
  { key: "lastName", labels: ["soyad", "lastname", "last_name", "soyisim"] },
  { key: "phone", labels: ["telefon", "phone", "cep", "gsm"] },
  { key: "email", labels: ["e-posta", "eposta", "email", "e_posta"] },
  { key: "birthDate", labels: ["doğum tarihi", "dogum_tarihi", "birthdate", "birth_date"] },
  { key: "gender", labels: ["cinsiyet", "gender"] },
  { key: "complaintAreas", labels: ["şikayet alanları", "sikayet_alanlari", "complaintareas"] },
] as const;

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[ışğüöç]/g, (c) =>
      ({ ı: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c" }[c] ?? c)
    )
    .replace(/\s+/g, "_");
}

function mapHeaderToKey(header: string): (typeof EXPECTED_COLUMNS)[number]["key"] | null {
  const n = normalizeHeader(header);
  for (const col of EXPECTED_COLUMNS) {
    if (col.labels.some((l) => n.includes(l) || l.includes(n))) return col.key;
  }
  return null;
}

function parseDate(val: string): string | undefined {
  if (!val?.trim()) return undefined;
  const s = String(val).trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD.MM.YYYY or DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return undefined;
}

function parseComplaintAreas(val: string): string[] {
  if (!val?.trim()) return [];
  return String(val)
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

interface ParsedRow {
  raw: Record<string, string>;
  mapped: ImportClientRow;
  errors: string[];
}

function validateRow(mapped: ImportClientRow): string[] {
  const errs: string[] = [];
  if (!mapped.firstName?.trim()) errs.push("Ad zorunludur");
  if (!mapped.lastName?.trim()) errs.push("Soyad zorunludur");
  if (mapped.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mapped.email))
    errs.push("Geçerli e-posta girin");
  if (mapped.phone && mapped.phone.length > 20) errs.push("Telefon en fazla 20 karakter");
  if (mapped.birthDate && isNaN(Date.parse(mapped.birthDate)))
    errs.push("Geçerli tarih girin (YYYY-MM-DD)");
  return errs;
}

function parseFile(
  file: File
): Promise<{ headers: string[]; rows: ParsedRow[]; columnMap: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const ext = file.name.toLowerCase().split(".").pop();

    if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<unknown[]>(ws, {
            header: 1,
            defval: "",
          });
          const headerRow = (json[0] ?? []) as string[];
          const headers = headerRow.map((h) => String(h ?? "").trim() || `Kolon${headerRow.indexOf(h) + 1}`);
          const columnMap: Record<string, string> = {};
          headers.forEach((h, i) => {
            const key = mapHeaderToKey(h);
            if (key) columnMap[headers[i]] = key;
          });
          const rows: ParsedRow[] = [];
          for (let i = 1; i < json.length; i++) {
            const arr = json[i] as (string | number)[];
            const raw: Record<string, string> = {};
            headers.forEach((h, j) => {
              raw[h] = arr[j] != null ? String(arr[j]).trim() : "";
            });
            const mapped = mapRawToRow(raw, columnMap);
            const errors = validateRow(mapped);
            rows.push({ raw, mapped, errors });
          }
          resolve({ headers, rows, columnMap });
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: "UTF-8",
        complete: (results) => {
          try {
            const rawRows = results.data as Record<string, string>[];
            const headers = results.meta.fields ?? (rawRows[0] ? Object.keys(rawRows[0]) : []);
            const columnMap: Record<string, string> = {};
            headers.forEach((h) => {
              const key = mapHeaderToKey(h);
              if (key) columnMap[h] = key;
            });
            const rows: ParsedRow[] = rawRows.map((raw) => {
              const mapped = mapRawToRow(raw, columnMap);
              const errors = validateRow(mapped);
              return { raw, mapped, errors };
            });
            resolve({ headers, rows, columnMap });
          } catch (err) {
            reject(err);
          }
        },
        error: (err) => reject(err),
      });
    }
  });
}

function mapRawToRow(
  raw: Record<string, string>,
  columnMap: Record<string, string>
): ImportClientRow {
  const get = (key: string) => {
    const col = Object.entries(columnMap).find(([, v]) => v === key)?.[0];
    return col ? raw[col] ?? "" : "";
  };
  const firstName = get("firstName") || raw["Ad"] || raw["ad"] || "";
  const lastName = get("lastName") || raw["Soyad"] || raw["soyad"] || "";
  const phone = get("phone") || raw["Telefon"] || raw["telefon"] || "";
  const email = get("email") || raw["E-posta"] || raw["eposta"] || raw["email"] || "";
  const birthDate = parseDate(get("birthDate") || raw["Doğum Tarihi"] || raw["dogum_tarihi"] || "");
  const gender = get("gender") || raw["Cinsiyet"] || raw["cinsiyet"] || "";
  const complaintStr =
    get("complaintAreas") ||
    raw["Şikayet Alanları"] ||
    raw["sikayet_alanlari"] ||
    raw["complaintAreas"] ||
    "";
  const complaintAreas = parseComplaintAreas(complaintStr);

  return {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phone: phone || undefined,
    email: email || undefined,
    birthDate: birthDate || undefined,
    gender: gender || undefined,
    complaintAreas: complaintAreas.length ? complaintAreas : undefined,
  };
}

export default function ClientsImportPage() {
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [parsed, setParsed] = React.useState<{
    headers: string[];
    rows: ParsedRow[];
    columnMap: Record<string, string>;
  } | null>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const parseMutation = React.useCallback(async (f: File) => {
    try {
      const result = await parseFile(f);
      setParsed(result);
      setFile(f);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dosya okunamadı");
    }
  }, []);

  const importMutation = useMutation({
    mutationFn: (rows: ImportClientRow[]) => importClients(rows),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success(
        `${res.imported} danışan içe aktarıldı${res.failed > 0 ? `, ${res.failed} satır hatalı` : ""}`
      );
      setFile(null);
      setParsed(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const validRows = React.useMemo(
    () => parsed?.rows.filter((r) => r.errors.length === 0).map((r) => r.mapped) ?? [],
    [parsed]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".csv") || f.name.endsWith(".xlsx") || f.name.endsWith(".xls")))
      parseMutation(f);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) parseMutation(f);
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/clients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold">Danışan İçe Aktar</h1>
      </div>

      <div className="rounded-lg border-2 border-dashed p-8">
        <div
          className={`flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-12 transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <FileSpreadsheet className="size-12 text-muted-foreground" />
          <p className="text-center text-sm text-muted-foreground">
            CSV veya Excel dosyasını sürükleyip bırakın veya dosya seçin
          </p>
          <p className="text-xs text-muted-foreground">
            Kolonlar: Ad, Soyad, Telefon, E-posta, Doğum Tarihi, Cinsiyet, Şikayet Alanları
          </p>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileInput}
            />
            <Button
              variant="outline"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" />
              Dosya Seç
            </Button>
          </div>
          <a
            href="/templates/danisan-import-sablonu.xlsx"
            download
            className="text-sm text-primary hover:underline"
          >
            Şablon indir
          </a>
        </div>
      </div>

      {parsed && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">
            Önizleme — {parsed.rows.length} satır, {validRows.length} geçerli
          </h2>
          <div className="max-h-[400px] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Ad</TableHead>
                  <TableHead>Soyad</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>E-posta</TableHead>
                  <TableHead>Doğum Tarihi</TableHead>
                  <TableHead>Cinsiyet</TableHead>
                  <TableHead>Şikayet Alanları</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.rows.map((row, i) => (
                  <TableRow
                    key={i}
                    className={row.errors.length > 0 ? "bg-destructive/10" : ""}
                  >
                    <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                    <TableCell>{row.mapped.firstName || "—"}</TableCell>
                    <TableCell>{row.mapped.lastName || "—"}</TableCell>
                    <TableCell>{row.mapped.phone || "—"}</TableCell>
                    <TableCell>{row.mapped.email || "—"}</TableCell>
                    <TableCell>{row.mapped.birthDate || "—"}</TableCell>
                    <TableCell>{row.mapped.gender || "—"}</TableCell>
                    <TableCell>
                      {row.mapped.complaintAreas?.join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      {row.errors.length > 0 ? (
                        <span className="text-xs text-destructive">
                          {row.errors.join("; ")}
                        </span>
                      ) : (
                        <span className="text-xs text-green-600">Geçerli</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => importMutation.mutate(validRows)}
              disabled={validRows.length === 0 || importMutation.isPending}
            >
              {importMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "İçe Aktar"
              )}
            </Button>
            <span className="text-sm text-muted-foreground">
              {validRows.length} geçerli satır aktarılacak
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
