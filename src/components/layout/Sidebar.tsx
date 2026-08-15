"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUIStore } from "@/store/useUIStore";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Store,
  CreditCard,
  Compass,
  Database,
  CalendarPlus,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export const navItems = [
  {
    title: "Resumen General",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Solicitudes Comercios",
    href: "/claims",
    icon: Store,
  },
  {
    title: "Suscripciones y Pagos",
    href: "/subscriptions",
    icon: CreditCard,
  },
  {
    title: "Catálogo de Lugares",
    href: "/catalog",
    icon: Compass,
  },
  {
    title: "ETL y Cargas Masivas",
    href: "/etl",
    icon: Database,
  },
  {
    title: "Alta de Eventos",
    href: "/events/new",
    icon: CalendarPlus,
  },
  {
    title: "Administradores",
    href: "/admins",
    icon: ShieldCheck,
  },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { isSidebarOpen, toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 transition-all duration-300",
        isSidebarOpen ? "w-64" : "w-20"
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-zinc-200 dark:border-zinc-800 transition-all",
          isSidebarOpen ? "justify-between px-4" : "justify-between px-3"
        )}
      >
        {isSidebarOpen ? (
          <>
            <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
              <img
                src="/logo.png"
                alt="DateBox"
                className="h-7 w-auto object-contain shrink-0"
              />
              <div className="flex flex-col min-w-0">
                <span className="font-heading text-base font-black tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight">
                  DateBox
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Admin Backoffice
                </span>
              </div>
            </Link>
            <button
              onClick={toggleSidebar}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:text-zinc-500 hover:text-zinc-900 transition-colors"
              title="Colapsar menú"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </>
        ) : (
          <div className="flex items-center justify-between w-full">
            <Link href="/" className="flex items-center justify-center shrink-0" title="DateBox Admin">
              <img
                src="/logo.png"
                alt="DateBox"
                className="h-6 w-auto object-contain"
              />
            </Link>
            <button
              onClick={toggleSidebar}
              className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:text-zinc-500 hover:text-zinc-900 transition-colors"
              title="Expandir menú"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation list */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150",
                isActive
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-subtle"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-50"
              )}
              title={!isSidebarOpen ? item.title : undefined}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-colors",
                  isActive
                    ? "text-white dark:text-zinc-950"
                    : "text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100"
                )}
              />
              {isSidebarOpen && <span className="truncate">{item.title}</span>}
            </Link>
          );
        })}
      </div>

      {/* Footer Info */}
      {isSidebarOpen && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-4">
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 p-3 border border-zinc-200/60 dark:border-zinc-800/60">
            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">DateBox Platform</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
              Consola administrativa para monitoreo de operaciones, reclamos y contenidos.
            </p>
          </div>
        </div>
      )}
    </aside>
  );
};
