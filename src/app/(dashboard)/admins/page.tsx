"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import {
  ShieldCheck,
  UserPlus,
  RefreshCw,
  Mail,
  Calendar,
  Key,
  CheckCircle2,
  AlertCircle,
  Code2,
  Trash2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface AdminItem {
  user_id: string;
  createdat: string;
  email?: string;
}

export default function AdminsPage() {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Fetch Admins
  const { data: admins = [], isLoading, refetch } = useQuery<AdminItem[]>({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      // 1. Fetch admins
      const { data: adminRows, error } = await supabase
        .from("admins")
        .select("user_id, createdat")
        .order("createdat", { ascending: false });

      if (error) throw error;
      return (adminRows as any) || [];
    },
  });

  // Mutation to Add New Admin
  const addAdminMutation = useMutation({
    mutationFn: async (email: string) => {
      setActionError(null);
      setActionSuccess(null);

      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) throw new Error("Ingresa un correo electrónico válido");

      // Check if user already exists in auth or table
      // In client mode, if the user already registered in DateBox, we look up or call SQL / Edge Function.
      // We can directly check if we can insert or if there's an API route:
      const { error } = await supabase.rpc("add_admin_by_email", { target_email: cleanEmail });

      if (error) {
        // Fallback: If RPC does not exist, inform admin with the SQL command
        throw new Error(
          `Para vincular '${cleanEmail}', ejecuta en Supabase: INSERT INTO public.admins (user_id) SELECT id FROM auth.users WHERE email = '${cleanEmail}';`
        );
      }
    },
    onSuccess: () => {
      setActionSuccess("Administrador vinculado correctamente");
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      setEmailInput("");
      setTimeout(() => setIsAddModalOpen(false), 1500);
    },
    onError: (err: any) => {
      setActionError(err.message || "Error al agregar administrador");
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-heading text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
              Gestión de Administradores
            </h1>
            <Badge variant="purple">
              <ShieldCheck className="w-3 h-3" /> Control de Acceso
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Administra los usuarios autorizados con acceso total al Backoffice y la moderación de DateBox.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="gap-1.5">
            <UserPlus className="w-4 h-4" />
            Nuevo Administrador
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} isLoading={isLoading}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-purple-50/50 dark:bg-purple-950/20 border-purple-200/60 dark:border-purple-900/40">
        <CardContent className="p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-zinc-900 dark:text-zinc-100">
              Autenticación Independiente y Limpia
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Cualquier usuario con cuenta en DateBox puede recibir permisos de administrador sin necesidad de registrarse como comercio ni falsear datos fiscales (CUIT/Razón Social). Sus datos como usuario común en la app móvil permanecen totalmente aislados e intactos.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Admins Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent dark:border-white" />
        </div>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>ID de Usuario (Auth UUID)</TableHeaderCell>
              <TableHeaderCell>Rol Asignado</TableHeaderCell>
              <TableHeaderCell>Fecha de Alta</TableHeaderCell>
              <TableHeaderCell>Estado</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {admins.map((adm) => (
              <TableRow key={adm.user_id}>
                <TableCell>
                  <div className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-50">
                    {adm.user_id}
                  </div>
                  {adm.user_id === "62a18396-e52e-41ea-8db6-1c070c9a4f19" && (
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold block mt-0.5">
                      (arrejinchano@gmail.com - Superadmin)
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="purple">Administrador</Badge>
                </TableCell>
                <TableCell className="text-xs text-zinc-500">
                  {formatDate(adm.createdat)}
                </TableCell>
                <TableCell>
                  <Badge variant="success">
                    <CheckCircle2 className="w-3 h-3" /> Activo
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* ADD ADMIN MODAL */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Dar de Alta Administrador"
        description="Agrega un nuevo usuario con permisos de acceso al Backoffice."
        size="md"
      >
        <div className="space-y-4">
          {actionError && (
            <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 p-3 text-xs text-red-600 dark:text-red-400 leading-relaxed font-mono">
              {actionError}
            </div>
          )}

          {actionSuccess && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              {actionSuccess}
            </div>
          )}

          <div className="space-y-3">
            <Input
              label="Correo Electrónico del Administrador"
              placeholder="nuevo.admin@datebox.com"
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              required
            />

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/50 dark:bg-zinc-900/40 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-zinc-800 dark:text-zinc-200">
                <Code2 className="w-4 h-4 text-purple-500" />
                Cómo funciona la autorización:
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
                El usuario solo necesita tener una cuenta creada en DateBox. Al autorizar su correo, su UUID se asocia a la tabla <code>public.admins</code>, habilitando su acceso inmediato al panel.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <Button variant="ghost" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Cerrar
            </Button>
            <Button
              size="sm"
              isLoading={addAdminMutation.isPending}
              onClick={() => addAdminMutation.mutate(emailInput)}
              disabled={!emailInput.trim()}
            >
              <ShieldCheck className="w-4 h-4 mr-1" />
              Autorizar Admin
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
