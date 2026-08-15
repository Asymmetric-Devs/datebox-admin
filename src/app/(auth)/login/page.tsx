"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { ShieldCheck, Lock, Mail, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage("Por favor ingresa tu correo y contraseña");
      return;
    }

    const res = await login(email, password);
    if (res.success) {
      router.push("/");
    } else {
      setErrorMessage(res.error || "Error al iniciar sesión");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
      {/* Top right theme toggle */}
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      {/* Background subtle gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-200/50 via-zinc-100/20 to-transparent dark:from-zinc-900/40 dark:via-zinc-950/20 dark:to-transparent pointer-events-none" />

      {/* Login Card */}
      <div className="relative w-full max-w-md rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/80 p-8 shadow-2xl backdrop-blur-xl transition-all">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="DateBox Logo"
            className="h-12 w-auto object-contain mx-auto mb-4"
          />
          <h1 className="font-heading text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
            DateBox Admin
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
            Panel de Operaciones, Moderación y Gestión
          </p>
        </div>

        {/* Error alert */}
        {errorMessage && (
          <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/30 p-3 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="font-medium leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              label="Correo Administrador"
              type="email"
              placeholder="admin@datebox.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <Input
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full mt-2"
            size="lg"
            isLoading={isLoading}
          >
            <ShieldCheck className="w-4 h-4 mr-1" />
            Ingresar al Panel
          </Button>
        </form>

        <div className="mt-8 border-t border-zinc-200 dark:border-zinc-800/80 pt-4 text-center">
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            Acceso restringido únicamente a personal autorizado de DateBox.
          </p>
        </div>
      </div>
    </div>
  );
}
