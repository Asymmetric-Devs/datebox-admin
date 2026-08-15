"use client";

import React from "react";
import { AdminGuard } from "@/components/layout/AdminGuard";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useUIStore } from "@/store/useUIStore";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isSidebarOpen = useUIStore((state) => state.isSidebarOpen);

  return (
    <AdminGuard>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <Sidebar />
        <Header />
        <div
          className={cn(
            "min-h-screen pt-20 pb-12 px-6 sm:px-10 transition-all duration-300",
            isSidebarOpen ? "ml-64" : "ml-20"
          )}
        >
          <main className="mx-auto max-w-7xl">{children}</main>
        </div>
      </div>
    </AdminGuard>
  );
}
