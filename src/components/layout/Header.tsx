"use client";

import React from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useUIStore } from "@/store/useUIStore";
import { ThemeToggle } from "./ThemeToggle";
import { LogOut, ShieldCheck, User } from "lucide-react";
import { Badge } from "../ui/Badge";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export const Header: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isSidebarOpen = useUIStore((state) => state.isSidebarOpen);
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 flex h-16 items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 px-6 backdrop-blur-md transition-all duration-300",
        isSidebarOpen ? "left-64" : "left-20"
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">DateBox Control</span>
        <Badge variant="purple" className="font-mono text-[11px]">
          <ShieldCheck className="w-3 h-3" />
          Superadmin
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />

        {user && (
          <div className="flex items-center gap-3 pl-3 border-l border-zinc-200 dark:border-zinc-800">
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{user.email}</span>
              <span className="text-[10px] text-zinc-400 font-mono">ID: {user.id.slice(0, 8)}...</span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              <User className="h-4 w-4" />
            </div>
            <button
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shadow-subtle"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
