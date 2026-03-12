"use client";

import { Bell, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/lib/api/auth";
import { Logo } from "@/components/logo";

const mobileNavItems = [
  { href: "/", label: "Ana Ekran" },
  { href: "/calendar", label: "Takvim" },
  { href: "/clients", label: "Danışanlar" },
  { href: "/tests", label: "Testler" },
  { href: "/notes", label: "Notlar" },
  { href: "/finance", label: "Gelir" },
  { href: "/profile", label: "Profil" },
  { href: "/settings", label: "Ayarlar" },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "Ana Ekran",
  "/calendar": "Takvim",
  "/clients": "Danışanlar",
  "/tests": "Testler",
  "/notes": "Notlar",
  "/finance": "Gelir",
  "/profile": "Profil",
  "/settings": "Ayarlar",
};

function getInitials(fullName?: string) {
  if (!fullName) return "?";
  return fullName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const base = "/" + pathname.split("/")[1];
  return PAGE_TITLES[base] ?? "";
}

export function DashboardHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { data: me } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    staleTime: 5 * 60 * 1000,
  });

  const initials = getInitials(me?.fullName);
  const pageTitle = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-4 lg:px-6">
      {/* Mobil menü */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild className="lg:hidden">
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Menu className="size-5" />
            <span className="sr-only">Menüyü aç</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-60 p-0 bg-sidebar border-sidebar-border">
          <SheetTitle className="sr-only">Navigasyon Menüsü</SheetTitle>
          <div className="flex flex-col h-full">
            <div className="flex h-14 items-center px-4 border-b border-sidebar-border">
              <Logo size="sm" variant="white" />
            </div>
            <nav className="flex-1 p-3 space-y-0.5">
              {mobileNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </SheetContent>
      </Sheet>

      {/* Page title */}
      {pageTitle && (
        <div className="hidden lg:flex items-center">
          <h2 className="text-sm font-semibold text-foreground">{pageTitle}</h2>
        </div>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        {/* Arama */}
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Search className="size-4" />
          <span className="sr-only">Ara</span>
        </Button>

        {/* Bildirimler */}
        <div className="relative">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Bell className="size-4" />
            <span className="sr-only">Bildirimler</span>
          </Button>
          <span className="absolute top-1.5 right-1.5 flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
          </span>
        </div>

        {/* Kullanıcı menüsü */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2.5 px-2 ml-1">
              <div className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 ring-2 ring-primary/20">
                {initials}
              </div>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-xs font-semibold leading-none max-w-[100px] truncate">
                  {me?.fullName?.split(" ")[0] ?? "Kullanıcı"}
                </span>
                <span className="text-[10px] text-muted-foreground leading-none mt-0.5">
                  Psikolog
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal py-2">
              <p className="text-sm font-semibold">{me?.fullName ?? "Kullanıcı"}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{me?.email ?? ""}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">Profil</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">Ayarlar</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" asChild>
              <Link
                href="/api/auth/do-logout"
                prefetch={false}
                onClick={() => {
                  localStorage.removeItem("access_token");
                  sessionStorage.removeItem("access_token");
                }}
              >
                Çıkış Yap
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
