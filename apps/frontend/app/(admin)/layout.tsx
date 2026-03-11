"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  FileCheck,
  Users,
  LogOut,
  ShieldCheck,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { apiFetch } from "@/lib/api/client";

interface Me {
  role: string;
  fullName: string;
  email: string;
}

const navItems = [
  { href: "/admin", label: "Genel Bakış", icon: LayoutDashboard, exact: true },
  { href: "/admin/tenants", label: "Tenantlar", icon: Building2, exact: false },
  { href: "/admin/licenses", label: "Lisans Onayları", icon: FileCheck, exact: false },
  { href: "/admin/users", label: "Kullanıcılar", icon: Users, exact: false },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    apiFetch<Me>("/auth/me")
      .then((data) => {
        if (data.role !== "SUPER_ADMIN") {
          router.replace("/dashboard");
        } else {
          setMe(data);
        }
      })
      .catch(() => router.replace("/login"))
      .finally(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!me) return null;

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Sidebar */}
      <aside className="w-60 bg-background border-r flex flex-col shrink-0">
        {/* Logo */}
        <div className="p-5 border-b">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <ShieldCheck className="size-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">Psikoport</p>
              <p className="text-xs text-muted-foreground">Süper Admin</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="p-3 border-t space-y-1">
          <div className="px-3 py-2">
            <p className="text-sm font-medium truncate">{me.fullName}</p>
            <p className="text-xs text-muted-foreground truncate">{me.email}</p>
          </div>
          <a
            href="/api/auth/logout"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <LogOut className="size-4 shrink-0" />
            Çıkış Yap
          </a>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
