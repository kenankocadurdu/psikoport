"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  fetchMyProfile,
  updateProfile,
  getPhotoUploadUrl,
  confirmPhotoUpload,
} from "@/lib/api/profile";
import { fetchMyBlogPost, upsertBlogPost } from "@/lib/api/blog";
import { TipTapEditor } from "@/components/blog/TipTapEditor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchMyProfile,
  });

  const { data: blogPost } = useQuery({
    queryKey: ["blog"],
    queryFn: fetchMyBlogPost,
  });

  const blogMutation = useMutation({
    mutationFn: upsertBlogPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog"] });
      toast.success("Blog yazısı kaydedildi");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profil güncellendi");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const [bio, setBio] = React.useState("");
  const [specializations, setSpecializations] = React.useState<string[]>([]);
  const [newSpec, setNewSpec] = React.useState("");
  const [education, setEducation] = React.useState<
    Array<{ school: string; degree?: string; year?: string }>
  >([]);
  const [sessionFee, setSessionFee] = React.useState("");
  const [seoTitle, setSeoTitle] = React.useState("");
  const [blogTitle, setBlogTitle] = React.useState("");
  const [blogContent, setBlogContent] = React.useState("");

  React.useEffect(() => {
    if (profile) {
      setBio(profile.bio ?? "");
      setSpecializations(profile.specializations ?? []);
      setEducation(
        (profile.education as Array<{ school: string; degree?: string; year?: string }>) ?? []
      );
      setSessionFee(
        profile.sessionFee != null ? String(profile.sessionFee) : ""
      );
      setSeoTitle(profile.seoTitle ?? "");
    }
  }, [profile]);

  React.useEffect(() => {
    if (blogPost) {
      setBlogTitle(blogPost.title);
      setBlogContent(blogPost.content);
    }
  }, [blogPost]);

  const handleAddSpec = () => {
    const t = newSpec.trim();
    if (t && !specializations.includes(t)) {
      setSpecializations([...specializations, t]);
      setNewSpec("");
    }
  };

  const handleRemoveSpec = (s: string) => {
    setSpecializations(specializations.filter((x) => x !== s));
  };

  const handleSave = () => {
    updateMutation.mutate({
      bio: bio || undefined,
      specializations,
      education: education.length ? education : undefined,
      sessionFee: sessionFee ? parseFloat(sessionFee) : undefined,
      seoTitle: seoTitle || undefined,
    });
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { uploadUrl, key } = await getPhotoUploadUrl(
        file.name,
        file.type
      );
      const res = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!res.ok) throw new Error("Yükleme başarısız");
      await confirmPhotoUpload(key);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Fotoğraf güncellendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fotoğraf yüklenemedi");
    }
    e.target.value = "";
  };

  const previewUrl = profile?.tenantSlug
    ? `/p/${profile.tenantSlug}`
    : null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Profil</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Kamuya açık profil sayfanızı düzenleyin
          </p>
        </div>
        {previewUrl && (
          <Link href={previewUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="size-4" />
              Önizleme
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fotoğraf</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="relative size-24 overflow-hidden rounded-full border bg-muted">
            {profile?.photoDisplayUrl ? (
              <img
                src={profile.photoDisplayUrl}
                alt="Profil"
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-2xl font-semibold text-muted-foreground">
                {profile?.fullName?.charAt(0) ?? "?"}
              </div>
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" />
              Fotoğraf Yükle
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hakkımda</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Kendinizi tanıtın..."
            rows={5}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uzmanlık Alanları</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newSpec}
              onChange={(e) => setNewSpec(e.target.value)}
              placeholder="Örn: Depresyon, Anksiyete"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSpec())}
            />
            <Button type="button" variant="secondary" onClick={handleAddSpec}>
              Ekle
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {specializations.map((s) => (
              <span
                key={s}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm"
              >
                {s}
                <button
                  type="button"
                  onClick={() => handleRemoveSpec(s)}
                  className="rounded-full hover:bg-primary/20"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seans Ücreti</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="number"
            value={sessionFee}
            onChange={(e) => setSessionFee(e.target.value)}
            placeholder="0"
            min={0}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SEO</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>SEO Başlık</Label>
          <Input
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            placeholder="Örn: Uzm. Psk. Ahmet Yılmaz | Psikolog"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Blog Yazısı</CardTitle>
          <p className="text-muted-foreground text-sm font-normal">
            Tek bir blog yazısı oluşturun veya düzenleyin
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>Başlık</Label>
          <Input
            value={blogTitle}
            onChange={(e) => setBlogTitle(e.target.value)}
            placeholder="Yazı başlığı"
          />
          <Label>İçerik</Label>
          <TipTapEditor
            content={blogContent}
            onChange={setBlogContent}
            className="min-h-[180px] rounded-md border"
          />
          <Button
            variant="secondary"
            onClick={() =>
              blogMutation.mutate({
                title: blogTitle,
                content: blogContent,
              })
            }
            disabled={blogMutation.isPending}
          >
            {blogMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Blog Kaydet
          </Button>
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={updateMutation.isPending}
      >
        {updateMutation.isPending && (
          <Loader2 className="size-4 animate-spin" />
        )}
        Profil Kaydet
      </Button>
    </div>
  );
}
