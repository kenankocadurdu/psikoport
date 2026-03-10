#!/usr/bin/env node
/**
 * Creates the client import template XLSX at apps/frontend/public/templates/danisan-import-sablonu.xlsx
 */
import * as XLSX from "xlsx";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "..", "apps", "frontend", "public", "templates");
const outPath = join(outDir, "danisan-import-sablonu.xlsx");

mkdirSync(outDir, { recursive: true });

const headers = [
  "Ad",
  "Soyad",
  "Telefon",
  "E-posta",
  "Doğum Tarihi",
  "Cinsiyet",
  "Şikayet Alanları",
];

const sampleRow = [
  "Ayşe",
  "Yılmaz",
  "0532 111 22 33",
  "ayse@example.com",
  "1990-05-15",
  "Kadın",
  "depresyon, anksiyete",
];

const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Danışanlar");

// Column widths
ws["!cols"] = [
  { wch: 15 },
  { wch: 15 },
  { wch: 18 },
  { wch: 25 },
  { wch: 14 },
  { wch: 12 },
  { wch: 30 },
];

XLSX.writeFile(wb, outPath);
console.log("Template created:", outPath);
