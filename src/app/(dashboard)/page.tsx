"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Store,
  CreditCard,
  Compass,
  Database,
  CalendarPlus,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function OverviewPage() {
  // Query 1: Claims stats
  const { data: claimsData } = useQuery({
    queryKey: ["dashboard-claims-stats"],
    queryFn: async () => {
      const { data, count, error } = await supabase
        .from("business_claim_event")
        .select("id, status", { count: "exact" });
      if (error) throw error;
      const pending = (data || []).filter((c) => c.status === "pending").length;
      const approved = (data || []).filter((c) => c.status === "approved").length;
      return { total: count || 0, pending, approved };
    },
  });

  // Query 2: Subscriptions stats
  const { data: subsData } = useQuery({
    queryKey: ["dashboard-subs-stats"],
    queryFn: async () => {
      const { data, count, error } = await supabase
        .from("merchant_subscriptions")
        .select("id, status, plan_id", { count: "exact" });
      if (error) throw error;
      const active = (data || []).filter(
        (s) => s.status === "authorized" || s.status === "active"
      ).length;
      const mrr = active * 20000; // base standard plan
      return { total: count || 0, active, mrr };
    },
  });

  // Query 3: Catalog events stats
  const { data: catalogData } = useQuery({
    queryKey: ["dashboard-catalog-stats"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("events")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return { totalEvents: count || 0 };
    },
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-heading text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
              Centro de Control
            </h1>
            <Badge variant="purple" className="text-[11px]">
              <Sparkles className="w-3 h-3" />
              Live Ops
            </Badge>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Resumen global de moderación, comercios B2B, suscripciones y contenido en DateBox.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/events/new">
            <Button size="md" className="gap-2">
              <CalendarPlus className="w-4 h-4" />
              Nuevo Evento
            </Button>
          </Link>
          <Link href="/etl">
            <Button variant="outline" size="md" className="gap-2">
              <Database className="w-4 h-4" />
              Ver ETL
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Reclamos Pendientes"
          value={claimsData?.pending ?? "-"}
          description="Solicitudes comerciales por moderar"
          icon={<Clock className="w-5 h-5 text-amber-500" />}
          variant={claimsData && claimsData.pending > 0 ? "warning" : "default"}
        />

        <StatCard
          title="Suscripciones Activas"
          value={subsData?.active ?? "-"}
          description="Comercios con cobro autorizado"
          icon={<CreditCard className="w-5 h-5 text-emerald-500" />}
          variant="success"
        />

        <StatCard
          title="MRR Estimado"
          value={subsData ? formatCurrency(subsData.mrr) : "-"}
          description="Ingresos recurrentes mensuales"
          icon={<TrendingUp className="w-5 h-5 text-purple-500" />}
          variant="purple"
        />

        <StatCard
          title="Lugares y Eventos"
          value={catalogData?.totalEvents ?? "-"}
          description="Total cargado en DateBox"
          icon={<Compass className="w-5 h-5 text-zinc-500" />}
        />
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:border-zinc-400 dark:hover:border-zinc-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-2.5 text-amber-600 dark:text-amber-400">
                <Store className="h-6 w-6" />
              </div>
              <Badge variant="warning">{claimsData?.pending || 0} pendientes</Badge>
            </div>
            <CardTitle className="mt-4">Moderación de Reclamos</CardTitle>
            <CardDescription>
              Revisa documentos presentados por comercios y valida la titularidad de locales.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/claims" className="inline-flex items-center text-xs font-bold text-zinc-900 dark:text-zinc-100 hover:underline gap-1">
              Ir a solicitudes <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:border-zinc-400 dark:hover:border-zinc-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-purple-50 dark:bg-purple-950/40 p-2.5 text-purple-600 dark:text-purple-400">
                <Database className="h-6 w-6" />
              </div>
              <Badge variant="purple">Pipelines</Badge>
            </div>
            <CardTitle className="mt-4">ETL y Cargas Masivas</CardTitle>
            <CardDescription>
              Ejecuta scripts de extracción, sincroniza fuentes externas y monitorea el scraping.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/etl" className="inline-flex items-center text-xs font-bold text-zinc-900 dark:text-zinc-100 hover:underline gap-1">
              Abrir consola ETL <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:border-zinc-400 dark:hover:border-zinc-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-zinc-100 dark:bg-zinc-800 p-2.5 text-zinc-900 dark:text-zinc-100">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <Badge variant="default">Seguridad</Badge>
            </div>
            <CardTitle className="mt-4">Gestión de Administradores</CardTitle>
            <CardDescription>
              Agrega nuevos miembros al equipo con acceso exclusivo al Backoffice de DateBox.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admins" className="inline-flex items-center text-xs font-bold text-zinc-900 dark:text-zinc-100 hover:underline gap-1">
              Gestionar equipo <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
