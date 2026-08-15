"use client";

import React, { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading, isInitialized, checkSession } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (isInitialized && !isLoading && !user) {
      router.push("/login");
    }
  }, [isInitialized, isLoading, user, router]);

  if (!isInitialized || isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <img
            src="/logo.png"
            alt="DateBox"
            className="h-10 w-auto object-contain mb-1 animate-pulse"
          />
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
            <span>Verificando credenciales de administrador...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
};
