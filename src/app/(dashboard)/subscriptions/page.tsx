"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminSubscriptions,
  fetchAdminPlans,
  createAdminPlan,
  AdminSubscriptionsData,
  AdminSubscriptionItem,
  SubscriptionPlan,
} from "@/lib/api";
import { StatCard } from "@/components/ui/StatCard";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  CreditCard,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  DollarSign,
  Zap,
  Sparkles,
  Layers,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"subscriptions" | "plans">("subscriptions");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreatePlanOpen, setIsCreatePlanOpen] = useState(false);

  // Form State
  const [planForm, setPlanForm] = useState({
    name: "",
    reason: "",
    price_ars: 25000,
    frequency_type: "months" as "months" | "days",
    max_venues: 1,
    max_special_events_per_month: 2,
    ai_boost_percentage: 15,
  });

  // Query 1: Subscriptions
  const { data: subsData, isLoading: isLoadingSubs, refetch: refetchSubs } = useQuery<AdminSubscriptionsData>({
    queryKey: ["admin-subscriptions"],
    queryFn: fetchAdminSubscriptions,
  });

  const subscriptions = subsData?.subscriptions || [];
  const metrics = subsData?.metrics || {
    totalRevenueEstimatedARS: 0,
    totalSubscriptions: 0,
    authorizedCount: 0,
    pendingCount: 0,
    pausedCount: 0,
    cancelledCount: 0,
  };

  // Query 2: Plans
  const { data: plans = [], isLoading: isLoadingPlans, refetch: refetchPlans } = useQuery<SubscriptionPlan[]>({
    queryKey: ["admin-plans"],
    queryFn: fetchAdminPlans,
  });

  // Mutation: Create Plan
  const createPlanMutation = useMutation({
    mutationFn: async (payload: typeof planForm) => {
      return createAdminPlan(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      setIsCreatePlanOpen(false);
      setPlanForm({
        name: "",
        reason: "",
        price_ars: 25000,
        frequency_type: "months",
        max_venues: 1,
        max_special_events_per_month: 2,
        ai_boost_percentage: 15,
      });
    },
  });

  // Calculate Metrics from backend response
  const activeSubs = metrics.authorizedCount || subscriptions.filter((s) => s.status?.toLowerCase() === "authorized" || s.status?.toLowerCase() === "active").length;
  const pendingSubs = metrics.pendingCount || subscriptions.filter((s) => s.status?.toLowerCase() === "pending").length;
  const pausedOrCancelledSubs = (metrics.pausedCount + metrics.cancelledCount) || subscriptions.filter((s) => s.status?.toLowerCase() === "paused" || s.status?.toLowerCase() === "cancelled").length;
  const totalRevenue = metrics.totalRevenueEstimatedARS;

  const filteredSubs = subscriptions.filter((sub) => {
    const bName = sub.business?.name_business?.toLowerCase() || "";
    const email = sub.payer_email?.toLowerCase() || sub.business?.mail?.toLowerCase() || "";
    const cuit = sub.business?.cuit || "";
    const q = searchTerm.toLowerCase();

    const matchesSearch = !q || bName.includes(q) || email.includes(q) || cuit.includes(q);
    const matchesStatus = statusFilter === "all" || sub.status?.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const getPlanDisplayName = (sub: AdminSubscriptionItem) => {
    const rawName =
      sub.business?.subscription ||
      plans.find((p) => p.id === sub.plan_id || p.id.toLowerCase() === sub.plan_id?.toLowerCase())?.name ||
      sub.plan_id ||
      "-";

    return rawName
      .split(" ")
      .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ""))
      .join(" ");
  };

  const getStatusBadge = (status?: string) => {
    const s = status?.toLowerCase() || "";
    if (s === "authorized" || s === "active") {
      return <Badge variant="success"><CheckCircle2 className="w-3 h-3" /> Aprobado</Badge>;
    }
    if (s === "pending") {
      return <Badge variant="warning"><Clock className="w-3 h-3" /> Pendiente</Badge>;
    }
    return <Badge variant="danger"><XCircle className="w-3 h-3" /> {status || "Inactivo"}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <h1 className="font-heading text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
            Suscripciones y Planes
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Monitoreo de cobros automáticos de comercios en Mercado Pago y configuración de planes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === "plans" && (
            <Button size="sm" onClick={() => setIsCreatePlanOpen(true)} className="gap-1.5">
              <Plus className="w-4 h-4" />
              Crear Plan
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchSubs();
              refetchPlans();
            }}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-6">
        <button
          onClick={() => setActiveTab("subscriptions")}
          className={`pb-3 text-sm font-bold transition-colors border-b-2 ${
            activeTab === "subscriptions"
              ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}
        >
          Suscripciones de Clientes ({subscriptions.length})
        </button>
        <button
          onClick={() => setActiveTab("plans")}
          className={`pb-3 text-sm font-bold transition-colors border-b-2 ${
            activeTab === "plans"
              ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}
        >
          Planes Disponibles ({plans.length})
        </button>
      </div>

      {/* TAB 1: SUBSCRIPTIONS */}
      {activeTab === "subscriptions" && (
        <div className="space-y-6">
          {/* KPI Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard
              title="MRR Estimado"
              value={formatCurrency(totalRevenue)}
              description="Facturación mensual proyectada"
              icon={<DollarSign className="w-5 h-5 text-emerald-500" />}
              variant="success"
            />
            <StatCard
              title="Suscripciones Activas"
              value={activeSubs}
              description="Comercios con débito activo"
              icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            />
            <StatCard
              title="Pagos Pendientes"
              value={pendingSubs}
              description="Cobros en proceso de validación"
              icon={<Clock className="w-5 h-5 text-amber-500" />}
              variant={pendingSubs > 0 ? "warning" : "default"}
            />
            <StatCard
              title="Pausadas / Canceladas"
              value={pausedOrCancelledSubs}
              description="Comercios inactivos"
              icon={<XCircle className="w-5 h-5 text-red-500" />}
              variant={pausedOrCancelledSubs > 0 ? "danger" : "default"}
            />
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, email o CUIT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-9 pr-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-400"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none"
            >
              <option value="all">Todos los estados</option>
              <option value="authorized">Aprobado / Activo</option>
              <option value="pending">Pendiente</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>

          {/* Subscriptions Table */}
          {isLoadingSubs ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent dark:border-white" />
            </div>
          ) : filteredSubs.length === 0 ? (
            <Card className="p-12 text-center">
              <CreditCard className="mx-auto h-10 w-10 text-zinc-400 mb-2 opacity-50" />
              <h3 className="font-heading font-bold text-zinc-900 dark:text-zinc-100">Sin suscripciones</h3>
              <p className="text-xs text-zinc-500 mt-1">No se encontraron cobros registrados con los filtros actuales.</p>
            </Card>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Comercio / Titular</TableHeaderCell>
                  <TableHeaderCell>Plan</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell>Email Pagador</TableHeaderCell>
                  <TableHeaderCell>ID Preapproval MP</TableHeaderCell>
                  <TableHeaderCell>Fecha</TableHeaderCell>
                  <TableHeaderCell className="text-right">Checkout</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSubs.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <div className="font-bold text-zinc-900 dark:text-zinc-50">
                        {sub.business?.name_business || "N/A"}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {sub.business?.name_owner || ""} · CUIT {sub.business?.cuit || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="purple" className="font-semibold">
                        {getPlanDisplayName(sub)}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(sub.status)}</TableCell>
                    <TableCell className="text-xs">{sub.payer_email || sub.business?.mail || "-"}</TableCell>
                    <TableCell className="font-mono text-xs text-zinc-500">
                      {sub.mp_preapproval_id || "N/A"}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-500">{formatDate(sub.created_at)}</TableCell>
                    <TableCell className="text-right">
                      {sub.checkout_url ? (
                        <a
                          href={sub.checkout_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 hover:underline"
                        >
                          Enlace MP <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* TAB 2: PLANS */}
      {activeTab === "plans" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card key={plan.id} className="flex flex-col justify-between hover:border-zinc-400 dark:hover:border-zinc-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="purple" className="uppercase text-[10px]">
                    {plan.status || "active"}
                  </Badge>
                  <Layers className="w-4 h-4 text-zinc-400" />
                </div>
                <CardTitle className="mt-2 text-xl">{plan.name}</CardTitle>
                <CardDescription className="line-clamp-2">{plan.reason || "Sin descripción"}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <span className="text-3xl font-black text-zinc-900 dark:text-zinc-50 font-heading">
                    {formatCurrency(plan.price_ars)}
                  </span>
                  <span className="text-xs text-zinc-400 ml-1">/ mes</span>
                </div>

                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 p-3 space-y-2 text-xs border border-zinc-200/60 dark:border-zinc-800/60">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Locales permitidos:</span>
                    <span className="font-bold">{plan.max_venues}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Eventos mensuales:</span>
                    <span className="font-bold">{plan.max_special_events_per_month}</span>
                  </div>
                  <div className="flex justify-between items-center text-purple-600 dark:text-purple-400">
                    <span className="flex items-center gap-1 font-medium">
                      <Sparkles className="w-3 h-3" /> Boost Algoritmo IA:
                    </span>
                    <span className="font-black">+{plan.ai_boost_percentage}%</span>
                  </div>
                </div>

                {plan.init_point ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      if (plan.init_point) window.open(plan.init_point, "_blank");
                    }}
                  >
                    Ver Checkout Directo <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* CREATE PLAN MODAL */}
      <Modal
        isOpen={isCreatePlanOpen}
        onClose={() => setIsCreatePlanOpen(false)}
        title="Crear Nuevo Plan de Suscripción"
        description="El plan se registrará en Mercado Pago para generar débitos automáticos."
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createPlanMutation.mutate(planForm);
          }}
          className="space-y-4"
        >
          <Input
            label="Nombre del Plan"
            placeholder="Ej: Plan Enterprise"
            value={planForm.name}
            onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
            required
          />

          <Input
            label="Motivo / Razón Mercado Pago"
            placeholder="Ej: Suscripción Mensual DateBox Enterprise"
            value={planForm.reason}
            onChange={(e) => setPlanForm({ ...planForm, reason: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Precio Mensual (ARS)"
              type="number"
              value={planForm.price_ars}
              onChange={(e) => setPlanForm({ ...planForm, price_ars: Number(e.target.value) })}
              required
            />
            <Input
              label="Locales Incluidos"
              type="number"
              value={planForm.max_venues}
              onChange={(e) => setPlanForm({ ...planForm, max_venues: Number(e.target.value) })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Eventos por Mes"
              type="number"
              value={planForm.max_special_events_per_month}
              onChange={(e) => setPlanForm({ ...planForm, max_special_events_per_month: Number(e.target.value) })}
              required
            />
            <Input
              label="Boost Recomendación IA (%)"
              type="number"
              value={planForm.ai_boost_percentage}
              onChange={(e) => setPlanForm({ ...planForm, ai_boost_percentage: Number(e.target.value) })}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsCreatePlanOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" isLoading={createPlanMutation.isPending}>
              Crear Plan en MP
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
