"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  ClipboardList,
  FileText,
  Wallet,
  User,
  Settings,
  LayoutDashboard,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

const mainNavItems = [
  { href: "/", label: "Ana Ekran", icon: LayoutDashboard },
  { href: "/calendar", label: "Takvim", icon: Calendar },
  { href: "/clients", label: "Danışanlar", icon: Users },
  { href: "/tests", label: "Testler", icon: ClipboardList },
  { href: "/notes", label: "Notlar", icon: FileText },
  { href: "/finance", label: "Gelir", icon: Wallet },
];

const accountNavItems = [
  { href: "/profile", label: "Profil", icon: User },
  { href: "/settings", label: "Ayarlar", icon: Settings },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const NavItem = ({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        title={collapsed ? label : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all duration-150",
          collapsed ? "justify-center px-2" : "px-3",
          active
            ? "bg-sidebar-primary/20 text-white"
            : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        )}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-r-full bg-sidebar-primary" />
        )}
        <Icon
          className={cn(
            "size-4 shrink-0 transition-colors",
            active ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80",
          )}
        />
        {!collapsed && <span>{label}</span>}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "hidden lg:flex lg:flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-in-out overflow-hidden shrink-0 relative",
        collapsed ? "lg:w-[60px]" : "lg:w-60",
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex h-14 items-center border-b border-sidebar-border shrink-0",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <Link href="/" className="flex items-center gap-2">
          {collapsed
            ? <Logo iconOnly size="sm" variant="white" />
            : <Logo size="sm" variant="white" />}
        </Link>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
            Menü
          </p>
        )}
        {mainNavItems.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}

        {!collapsed && (
          <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
            Hesap
          </p>
        )}
        {collapsed && <div className="my-2 border-t border-sidebar-border/50" />}
        {accountNavItems.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="p-3 border-t border-sidebar-border shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Menüyü genişlet" : "Menüyü küçült"}
          className={cn(
            "flex items-center gap-2 rounded-lg py-2 px-3 text-xs text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors w-full",
            collapsed && "justify-center px-2",
          )}
        >
          {collapsed ? <ChevronRight className="size-4" /> : (
            <>
              <ChevronLeft className="size-4" />
              <span>Küçült</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
