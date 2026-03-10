"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MapPin, GraduationCap, Briefcase, Languages, Calendar } from "lucide-react";
import Image from "next/image";

interface PublicProfileViewProps {
  profile: {
    fullName: string;
    bio: string | null;
    specializations: string[];
    education: Array<{ school?: string; degree?: string; year?: string }>;
    experience: Array<{ title?: string; organization?: string; years?: string }>;
    photoUrl: string | null;
    sessionTypes: string[];
    sessionFee: number | null;
    officeAddress: string | null;
    languages: string[];
  };
  slug: string;
}

export function PublicProfileView({ profile, slug }: PublicProfileViewProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="bg-slate-100 dark:bg-slate-800/50 px-6 py-8">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <div className="relative size-32 shrink-0 overflow-hidden rounded-full border-4 border-white shadow-lg dark:border-slate-800">
                {profile.photoUrl ? (
                  <Image
                    src={profile.photoUrl}
                    alt={profile.fullName}
                    fill
                    className="object-cover"
                    sizes="128px"
                    unoptimized
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-slate-300 text-3xl font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                    {profile.fullName.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-2xl font-bold tracking-tight">
                  {profile.fullName}
                </h1>
                <p className="mt-1 text-slate-600 dark:text-slate-400">
                  Psikolog
                </p>
                {profile.specializations?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
                    {profile.specializations.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <CardContent className="space-y-6 p-6 pt-6">
            {profile.bio && (
              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Hakkımda
                </h2>
                <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                  {profile.bio}
                </p>
              </section>
            )}

            {profile.education?.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  <GraduationCap className="size-4" />
                  Eğitim
                </h2>
                <ul className="space-y-1">
                  {profile.education.map((e, i) => (
                    <li key={i} className="text-slate-700 dark:text-slate-300">
                      {e.school}
                      {e.degree && ` — ${e.degree}`}
                      {e.year && ` (${e.year})`}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {profile.experience?.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  <Briefcase className="size-4" />
                  Deneyim
                </h2>
                <ul className="space-y-1">
                  {profile.experience.map((e, i) => (
                    <li key={i} className="text-slate-700 dark:text-slate-300">
                      {e.title}
                      {e.organization && ` — ${e.organization}`}
                      {e.years && ` (${e.years})`}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {profile.languages?.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  <Languages className="size-4" />
                  Diller
                </h2>
                <p className="text-slate-700 dark:text-slate-300">
                  {profile.languages.join(", ")}
                </p>
              </section>
            )}

            <section className="rounded-lg border bg-slate-50 p-4 dark:bg-slate-800/30">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                <Calendar className="size-4" />
                Seans Bilgileri
              </h2>
              <div className="space-y-1 text-slate-700 dark:text-slate-300">
                {profile.sessionTypes?.length > 0 && (
                  <p>Seans türleri: {profile.sessionTypes.join(", ")}</p>
                )}
                {profile.sessionFee != null && profile.sessionFee > 0 && (
                  <p>Seans ücreti: ₺{profile.sessionFee.toLocaleString("tr-TR")}</p>
                )}
                {profile.officeAddress && (
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0" />
                    {profile.officeAddress}
                  </p>
                )}
              </div>
            </section>

            <div className="pt-4">
              <Button size="lg" className="w-full sm:w-auto" disabled>
                Randevu Al
              </Button>
              <p className="mt-2 text-xs text-slate-500">
                Randevu sistemi yakında aktif olacaktır.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
