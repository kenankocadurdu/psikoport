#!/usr/bin/env node
/**
 * Converts danisan_karsilama_formlari.xlsx to JSON form schemas.
 * Run: node shared/scripts/convert-intake-xlsx.mjs
 */
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const XLSX_PATH = path.join(__dirname, '../../my_docs/danisan_karsilama_formlari.xlsx');
const OUT_DIR = path.join(__dirname, '../packages/form-schemas/intake');

function typeMap(t) {
  const m = {
    'Metin (kısa)': 'text_short',
    'Uzun metin (textarea)': 'text_long',
    'Tekli seçim (radio)': 'single_select',
    'Tekli seçim (dropdown)': 'single_select',
    'Tekli seçim': 'single_select',
    'Çoklu seçim': 'multi_select',
    'Çoklu seçim (checkbox)': 'multi_select',
    'Likert (1-10)': 'scale',
    'Likert (0-10)': 'scale',
    'Sayı (11 hane)': 'number',
    'Sayı': 'number',
    'Tarih seçici': 'date',
    'Telefon': 'phone',
    'E-posta': 'email',
    'Tekli seçim + Metin': 'single_select',
    'Çoklu seçim + Metin': 'multi_select',
  };
  return m[t] || 'text_short';
}

function parseOptions(str) {
  if (!str || typeof str !== 'string') return [];
  return str.split('|').map(s => s.trim()).filter(Boolean).map((label, i) => {
    const slug = label.toLowerCase()
      .replace(/[^a-z0-9\u00c0-\u024f\u1e00-\u1eff]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || `opt_${i}`;
    return { value: slug, label };
  });
}

function parseSheet(rows) {
  const sections = [];
  let currentSection = null;
  let fieldNo = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = Array.isArray(rows[i]) ? rows[i] : [];
    const col0 = String(row[0] ?? '').trim();
    const col1 = String(row[1] ?? '').trim();
    const col2 = String(row[2] ?? '').trim();
    const col3 = String(row[3] ?? '').trim();
    const col4 = String(row[4] ?? '').trim();
    const col5 = String(row[5] ?? '').trim();
    const col6 = String(row[6] ?? '').trim();

    const sectionTitle = col0 || col1;
    if (sectionTitle && sectionTitle.includes('BÖLÜM') && !col2) {
      currentSection = {
        id: `section_${sections.length + 1}`,
        title: sectionTitle.replace(/^[^\s]+\s*/, '').replace(/\s*:\s*/, ': '),
        icon: 'file-text',
        fields: []
      };
      sections.push(currentSection);
      continue;
    }

    const num = parseInt(col0, 10);
    if (isNaN(num) || !col1 || !currentSection) continue;

    fieldNo++;
    const fieldId = `q${fieldNo}`;
    const required = col4 === 'Zorunlu';
    let options = [];
    if (col2.includes('seçim') || col2.includes('Likert') || col2.includes('scale')) {
      options = parseOptions(col3);
    }

    const field = {
      id: fieldId,
      type: typeMap(col2),
      label: col1,
      required,
      placeholder: col6 || undefined
    };
    if (options.length) field.options = options;

    if (col5 && col5.includes('KRİZ') && col5.includes('tetiklenir')) {
      field.crisisTrigger = { values: ['current', 'Şu anda düşüncem var'], action: 'crisis_protocol' };
    }
    if (col1.includes('Yardım almak istediğiniz alanlar') || col1.includes('complaint_areas')) {
      field.triggersAddonForms = true;
    }
    if (col5 && col5.includes('Koşullu') && col5.includes('Evet')) {
      field.condition = { field: 'q' + (fieldNo - 1), operator: 'equals', value: 'evet' };
    }
    if (col5 && col5.includes('Cinsiyet') && col5.includes('Kadın')) {
      field.condition = { field: 'q5', operator: 'equals', value: 'kadin' };
    }
    if (col5 && col5.includes('Yok') && col5.includes('Bilmiyorum') && col5.includes('dışı')) {
      field.condition = { field: 'q37', operator: 'not_equals', value: 'yok' };
    }

    currentSection.fields.push(field);
  }
  return sections;
}

const wb = XLSX.readFile(XLSX_PATH);
const configs = [
  { sheet: 'Genel Karşılama Formu', out: 'general.json', code: 'INTAKE', formType: 'INTAKE', title: 'Genel Danışan Karşılama Formu', desc: 'Tüm danışanların ilk başvuruda doldurduğu temel bilgi formu.' },
  { sheet: 'Depresyon', out: 'depression.json', code: 'INTAKE_DEPRESSION', formType: 'INTAKE_ADDON', title: 'Depresyon Ek Formu', desc: 'Depresyon/mutsuzluk şikayeti olan danışanlar için ek değerlendirme.' },
  { sheet: 'Anksiyete-Panik', out: 'anxiety-panic.json', code: 'INTAKE_ANXIETY_PANIC', formType: 'INTAKE_ADDON', title: 'Anksiyete/Panik Ek Formu', desc: 'Kaygı, endişe veya panik atak şikayeti olan danışanlar için.' },
  { sheet: 'Travma-TSSB', out: 'trauma-ptsd.json', code: 'INTAKE_TRAUMA_PTSD', formType: 'INTAKE_ADDON', title: 'Travma Ek Formu', desc: 'Travmatik yaşantı veya TSSB şikayeti olan danışanlar için.' },
];

for (const cfg of configs) {
  const ws = wb.Sheets[cfg.sheet];
  if (!ws) { console.warn('Sheet not found:', cfg.sheet); continue; }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const sections = parseSheet(rows);
  const schema = { version: 1, sections };
  const form = {
    code: cfg.code,
    title: cfg.title,
    description: cfg.desc,
    formType: cfg.formType,
    category: 'intake',
    estimatedMinutes: sections.reduce((s, sec) => s + sec.fields.length, 0) * 0.5,
    schema
  };
  const outPath = path.join(OUT_DIR, cfg.out);
  fs.writeFileSync(outPath, JSON.stringify(form, null, 2), 'utf8');
  console.log('Wrote', cfg.out, '-', sections.length, 'sections,', sections.reduce((a, s) => a + s.fields.length, 0), 'fields');
}
