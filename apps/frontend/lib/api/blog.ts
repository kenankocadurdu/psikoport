import { apiFetch } from "./client";

export interface BlogPost {
  id: string;
  title: string;
  content: string;
  publishedAt: string | null;
}

export function fetchMyBlogPost(): Promise<BlogPost | null> {
  return apiFetch<BlogPost | null>("/blog");
}

export function upsertBlogPost(data: {
  title: string;
  content: string;
  publishedAt?: string | null;
}): Promise<BlogPost> {
  return apiFetch("/blog", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
