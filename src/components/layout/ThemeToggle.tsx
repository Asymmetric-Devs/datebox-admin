"use client";

import React, { useEffect } from "react";
import { useUIStore } from "@/store/useUIStore";
import { Sun, Moon } from "lucide-react";

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme, setTheme } = useUIStore();

  useEffect(() => {
    const saved = localStorage.getItem("datebox_admin_theme") as "light" | "dark" | null;
    if (saved) {
      setTheme(saved);
    } else {
      setTheme("dark");
    }
  }, [setTheme]);

  return (
    <button
      onClick={toggleTheme}
      title={theme === "dark" ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shadow-subtle"
    >
      {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-700" />}
    </button>
  );
};
