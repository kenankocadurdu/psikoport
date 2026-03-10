/**
 * Semptom taksonomisi — MASTER_README Section 6 (symptom_taxonomy seed data)
 * Kategoriler: duygudurum, anksiyete, travma, okb, iliski, stres, fizyolojik, bagimlilik, benlik, cocuk_ergen, diger
 */

export interface SymptomTaxonomyItem {
  code: string;
  labelTr: string;
  labelEn?: string;
  category: string;
  parentCode?: string;
  sortOrder: number;
}

export const SYMPTOM_TAXONOMY: readonly SymptomTaxonomyItem[] = [
  // duygudurum
  { code: 'depresyon', labelTr: 'Depresyon', labelEn: 'Depression', category: 'duygudurum', sortOrder: 1 },
  { code: 'anksiyete', labelTr: 'Kaygı/Anksiyete', labelEn: 'Anxiety', category: 'duygudurum', sortOrder: 2 },
  { code: 'melankoli', labelTr: 'Melankoli', labelEn: 'Melancholia', category: 'duygudurum', sortOrder: 3 },
  { code: 'anhedoni', labelTr: 'Anhedoni (zev alamama)', labelEn: 'Anhedonia', category: 'duygudurum', sortOrder: 4 },
  { code: 'irritabilite', labelTr: 'Sinirlilik', labelEn: 'Irritability', category: 'duygudurum', sortOrder: 5 },
  { code: 'umutsuzluk', labelTr: 'Umutsuzluk', labelEn: 'Hopelessness', category: 'duygudurum', sortOrder: 6 },
  { code: 'duygusal_dalgalanma', labelTr: 'Duygusal dalgalanma', labelEn: 'Mood swings', category: 'duygudurum', sortOrder: 7 },
  { code: 'mani_hipomani', labelTr: 'Mani/Hipomani belirtileri', labelEn: 'Mania/Hypomania', category: 'duygudurum', sortOrder: 8 },
  // anksiyete
  { code: 'panik', labelTr: 'Panik atak', labelEn: 'Panic attack', category: 'anksiyete', sortOrder: 10 },
  { code: 'sosyal_anksiyete', labelTr: 'Sosyal kaygı', labelEn: 'Social anxiety', category: 'anksiyete', sortOrder: 11 },
  { code: 'genel_kaygi', labelTr: 'Genelleşmiş kaygı', labelEn: 'Generalized anxiety', category: 'anksiyete', sortOrder: 12 },
  { code: 'fobi', labelTr: 'Fobi', labelEn: 'Phobia', category: 'anksiyete', sortOrder: 13 },
  { code: 'saglik_kaygisi', labelTr: 'Sağlık kaygısı', labelEn: 'Health anxiety', category: 'anksiyete', sortOrder: 14 },
  { code: 'obsesif_dusunce', labelTr: 'Takıntılı düşünceler', labelEn: 'Obsessive thoughts', category: 'anksiyete', sortOrder: 15 },
  { code: 'beklenti_anksiyetesi', labelTr: 'Beklenti kaygısı', labelEn: 'Anticipatory anxiety', category: 'anksiyete', sortOrder: 16 },
  // travma
  { code: 'tssb', labelTr: 'TSSB belirtileri', labelEn: 'PTSD symptoms', category: 'travma', sortOrder: 20 },
  { code: 'flashback', labelTr: 'Flashback/geri dönüş', labelEn: 'Flashback', category: 'travma', sortOrder: 21 },
  { code: 'kacinma', labelTr: 'Kaçınma', labelEn: 'Avoidance', category: 'travma', sortOrder: 22 },
  { code: 'hipervijilans', labelTr: 'Hipervijilans', labelEn: 'Hypervigilance', category: 'travma', sortOrder: 23 },
  { code: 'dissosiyasyon', labelTr: 'Dissosiyasyon', labelEn: 'Dissociation', category: 'travma', sortOrder: 24 },
  { code: 'travma_sonrasi', labelTr: 'Travma sonrası tepkiler', labelEn: 'Post-trauma reactions', category: 'travma', sortOrder: 25 },
  // okb
  { code: 'obsesyon', labelTr: 'Obsesyon', labelEn: 'Obsession', category: 'okb', sortOrder: 30 },
  { code: 'kompulsiyon', labelTr: 'Kompulsiyon', labelEn: 'Compulsion', category: 'okb', sortOrder: 31 },
  { code: 'kontrol_ihtiyaci', labelTr: 'Kontrol ihtiyacı', labelEn: 'Need for control', category: 'okb', sortOrder: 32 },
  { code: 'simetri_duzen', labelTr: 'Simetri/düzen takıntısı', labelEn: 'Symmetry/order obsession', category: 'okb', sortOrder: 33 },
  { code: 'temizlik_takinti', labelTr: 'Temizlik/kirlenme takıntısı', labelEn: 'Cleaning/contamination obsession', category: 'okb', sortOrder: 34 },
  // iliski
  { code: 'baglanma', labelTr: 'Bağlanma sorunları', labelEn: 'Attachment issues', category: 'iliski', sortOrder: 40 },
  { code: 'guven_sorunu', labelTr: 'Güven sorunu', labelEn: 'Trust issues', category: 'iliski', sortOrder: 41 },
  { code: 'iletisim', labelTr: 'İletişim zorluğu', labelEn: 'Communication difficulty', category: 'iliski', sortOrder: 42 },
  { code: 'sinir_sorunu', labelTr: 'Sınır sorunları', labelEn: 'Boundary issues', category: 'iliski', sortOrder: 43 },
  { code: 'yakinlik_korkusu', labelTr: 'Yakınlık korkusu', labelEn: 'Fear of intimacy', category: 'iliski', sortOrder: 44 },
  { code: 'celiski', labelTr: 'İlişkisel çatışma', labelEn: 'Relational conflict', category: 'iliski', sortOrder: 45 },
  // stres
  { code: 'tukenmislik', labelTr: 'Tükenmişlik', labelEn: 'Burnout', category: 'stres', sortOrder: 50 },
  { code: 'is_stresi', labelTr: 'İş stresi', labelEn: 'Work stress', category: 'stres', sortOrder: 51 },
  { code: 'basa_cikma', labelTr: 'Başa çıkma zorluğu', labelEn: 'Coping difficulty', category: 'stres', sortOrder: 52 },
  { code: 'kronik_stres', labelTr: 'Kronik stres', labelEn: 'Chronic stress', category: 'stres', sortOrder: 53 },
  { code: 'yasam_degisikligi', labelTr: 'Yaşam değişikliği stresi', labelEn: 'Life change stress', category: 'stres', sortOrder: 54 },
  // fizyolojik
  { code: 'uyku', labelTr: 'Uyku sorunları', labelEn: 'Sleep problems', category: 'fizyolojik', sortOrder: 60 },
  { code: 'istah', labelTr: 'İştah değişikliği', labelEn: 'Appetite change', category: 'fizyolojik', sortOrder: 61 },
  { code: 'yorgunluk', labelTr: 'Kronik yorgunluk', labelEn: 'Chronic fatigue', category: 'fizyolojik', sortOrder: 62 },
  { code: 'agri', labelTr: 'Psikojenik ağrı', labelEn: 'Psychogenic pain', category: 'fizyolojik', sortOrder: 63 },
  { code: 'somatik', labelTr: 'Somatik belirtiler', labelEn: 'Somatic symptoms', category: 'fizyolojik', sortOrder: 64 },
  { code: 'enerji_dusuklugu', labelTr: 'Enerji düşüklüğü', labelEn: 'Low energy', category: 'fizyolojik', sortOrder: 65 },
  // bagimlilik
  { code: 'alkol', labelTr: 'Alkol kullanımı', labelEn: 'Alcohol use', category: 'bagimlilik', sortOrder: 70 },
  { code: 'madde', labelTr: 'Madde kullanımı', labelEn: 'Substance use', category: 'bagimlilik', sortOrder: 71 },
  { code: 'teknoloji', labelTr: 'Teknoloji/ekran bağımlılığı', labelEn: 'Technology addiction', category: 'bagimlilik', sortOrder: 72 },
  { code: 'kumar', labelTr: 'Kumar', labelEn: 'Gambling', category: 'bagimlilik', sortOrder: 73 },
  { code: 'tutun', labelTr: 'Tütün kullanımı', labelEn: 'Tobacco use', category: 'bagimlilik', sortOrder: 74 },
  // benlik
  { code: 'benlik_saygisi', labelTr: 'Benlik saygısı', labelEn: 'Self-esteem', category: 'benlik', sortOrder: 80 },
  { code: 'kimlik', labelTr: 'Kimlik/benlik sorunu', labelEn: 'Identity issues', category: 'benlik', sortOrder: 81 },
  { code: 'oz_deger', labelTr: 'Öz-değer', labelEn: 'Self-worth', category: 'benlik', sortOrder: 82 },
  { code: 'suculuk_utanç', labelTr: 'Suçluluk/utanç', labelEn: 'Guilt/shame', category: 'benlik', sortOrder: 83 },
  // cocuk_ergen
  { code: 'davranis', labelTr: 'Davranış sorunları', labelEn: 'Behavioral problems', category: 'cocuk_ergen', sortOrder: 90 },
  { code: 'dikkat', labelTr: 'Dikkat/konsantrasyon', labelEn: 'Attention/concentration', category: 'cocuk_ergen', sortOrder: 91 },
  { code: 'gelisim', labelTr: 'Gelişimsel sorunlar', labelEn: 'Developmental issues', category: 'cocuk_ergen', sortOrder: 92 },
  { code: 'okul', labelTr: 'Okul/akademik sorunlar', labelEn: 'School/academic issues', category: 'cocuk_ergen', sortOrder: 93 },
  { code: 'akran', labelTr: 'Akran ilişkileri', labelEn: 'Peer relationships', category: 'cocuk_ergen', sortOrder: 94 },
  // diger
  { code: 'belirsiz', labelTr: 'Belirsiz/henüz netleşmemiş', labelEn: 'Unclear/undefined', category: 'diger', sortOrder: 100 },
  { code: 'yasta', labelTr: 'Yas/Kayıp', labelEn: 'Grief/Loss', category: 'diger', sortOrder: 101 },
  { code: 'yasam_anlami', labelTr: 'Yaşam anlamı/değerleri', labelEn: 'Life meaning/values', category: 'diger', sortOrder: 102 },
  { code: 'karar_verme', labelTr: 'Karar verme zorluğu', labelEn: 'Decision-making difficulty', category: 'diger', sortOrder: 103 },
] as const;
