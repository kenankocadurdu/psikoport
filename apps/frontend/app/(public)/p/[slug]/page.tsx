import { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicProfileView } from "./profile-view";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function getProfile(slug: string) {
  try {
    const res = await fetch(
      `${API_URL}/profile/public/${encodeURIComponent(slug)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getProfile(slug);
  if (!profile) return { title: "Profil Bulunamadı" };

  const title =
    profile.seoTitle ??
    `${profile.fullName} | Psikolog | Psikoport`;
  const description =
    profile.seoDescription ??
    (profile.bio
      ? profile.bio.slice(0, 160) + (profile.bio.length > 160 ? "..." : "")
      : `${profile.fullName} — Psikolog profili`);

  return {
    title,
    description,
    keywords: profile.seoKeywords?.split(",").map((k: string) => k.trim()),
    openGraph: { title, description, type: "profile" },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { slug } = await params;
  const profile = await getProfile(slug);
  if (!profile) notFound();

  const schemaOrg = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        name: profile.fullName,
        jobTitle: "Psikolog",
        description: profile.seoDescription ?? profile.bio,
        image: profile.photoUrl,
        knowsLanguage: profile.languages?.length
          ? profile.languages.map((l: string) => ({ "@type": "Language", name: l }))
          : undefined,
      },
      {
        "@type": "LocalBusiness",
        name: profile.fullName,
        description: profile.seoDescription ?? profile.bio,
        image: profile.photoUrl,
        "@id": `https://psikoport.com/p/${slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
      />
      <PublicProfileView profile={profile} slug={slug} />
    </>
  );
}
