"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchCatalogContent, toggleCatalogStatus, CatalogItem } from "@/lib/api";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import {
  Compass,
  Store,
  Calendar,
  Search,
  RefreshCw,
  MapPin,
  ExternalLink,
  Tag,
  CheckCircle,
  XCircle,
  Eye,
  Building,
  Image as ImageIcon,
  LayoutGrid,
  Table as TableIcon,
  Clock,
  DollarSign,
  Star,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Landmark,
  PartyPopper,
  Utensils,
  Trees,
  SlidersHorizontal,
  ChevronRight,
} from "lucide-react";

// -------------------------------------------------------------
// Archetypes Definition from docs/EVENTS_MODEL.md
// -------------------------------------------------------------
type EventArchetypeKey = "all" | "cultural_event" | "commercial_event" | "commercial_place" | "public_space";

interface EventArchetypeInfo {
  key: EventArchetypeKey;
  label: string;
  shortLabel: string;
  badgeVariant: "purple" | "warning" | "success" | "default";
  icon: React.ElementType;
  colorClass: string;
  description: string;
}

function getEventArchetype(item: { is_temporary?: boolean; is_commercial?: boolean }): EventArchetypeInfo {
  if (item.is_temporary && !item.is_commercial) {
    return {
      key: "cultural_event",
      label: "Evento Cultural / Público",
      shortLabel: "Cultural / Público",
      badgeVariant: "warning",
      icon: Landmark,
      colorClass: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60",
      description: "Evento único/puntual gratuito o de gestión pública (festivales, ferias, conciertos en plazas).",
    };
  }
  if (item.is_temporary && item.is_commercial) {
    return {
      key: "commercial_event",
      label: "Evento Comercial / Shows",
      shortLabel: "Evento Comercial",
      badgeVariant: "purple",
      icon: PartyPopper,
      colorClass: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900/60",
      description: "Evento puntual de pago, shows, fiestas con ticket o promociones B2B patrocinadas.",
    };
  }
  if (!item.is_temporary && item.is_commercial) {
    return {
      key: "commercial_place",
      label: "Local Comercial / Gastronomía",
      shortLabel: "Local Comercial",
      badgeVariant: "success",
      icon: Utensils,
      colorClass: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60",
      description: "Bar, restaurante, cafetería o local comercial permanente de atención al público.",
    };
  }
  return {
    key: "public_space",
    label: "Espacio Público / Abierto",
    shortLabel: "Espacio Público",
    badgeVariant: "default",
    icon: Trees,
    colorClass: "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900/60",
    description: "Plaza, parque, costanera o paseo artesanal de acceso libre y continuo.",
  };
}

const DAYS_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function CatalogPage() {
  const queryClient = useQueryClient();

  // Filters & State
  const [searchTerm, setSearchTerm] = useState("");
  const [archetypeFilter, setArchetypeFilter] = useState<EventArchetypeKey>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [showRawMetadata, setShowRawMetadata] = useState(false);

  // Switchable filter modes for top KPI cards: "active" | "total" | "inactive"
  const [cardFilterModes, setCardFilterModes] = useState<Record<string, "active" | "total" | "inactive">>({
    cultural_event: "active",
    commercial_event: "active",
    commercial_place: "active",
    public_space: "active",
  });

  // Pagination / Infinite scroll
  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Fetch Events from API / Supabase
  const { data: items = [], isLoading, refetch } = useQuery<CatalogItem[]>({
    queryKey: ["admin-catalog"],
    queryFn: fetchCatalogContent,
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: boolean }) => {
      return toggleCatalogStatus(id, newStatus);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-catalog"] });
      if (selectedItem) {
        setSelectedItem((prev) => (prev ? { ...prev, status: !prev.status } : null));
      }
    },
  });

  // Unique categories list
  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category).filter(Boolean));
    return Array.from(set).sort();
  }, [items]);

  // Archetype metrics calculation
  const metrics = useMemo(() => {
    const stats = {
      total: items.length,
      active: 0,
      inactive: 0,
      cultural_event: { total: 0, active: 0, inactive: 0 },
      commercial_event: { total: 0, active: 0, inactive: 0 },
      commercial_place: { total: 0, active: 0, inactive: 0 },
      public_space: { total: 0, active: 0, inactive: 0 },
    };

    items.forEach((item) => {
      const isAct = Boolean(item.status);
      if (isAct) stats.active++;
      else stats.inactive++;

      const arch = getEventArchetype(item).key as "cultural_event" | "commercial_event" | "commercial_place" | "public_space";
      stats[arch].total++;
      if (isAct) stats[arch].active++;
      else stats[arch].inactive++;
    });

    return stats;
  }, [items]);

  // Filtering
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = searchTerm.trim().toLowerCase();
      const text = [
        item.title,
        item.description,
        item.category,
        item.address,
        item.venue_name,
        item.organizer_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (q && !text.includes(q)) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;

      const arch = getEventArchetype(item).key;
      if (archetypeFilter !== "all" && arch !== archetypeFilter) return false;

      if (statusFilter === "active" && !item.status) return false;
      if (statusFilter === "inactive" && item.status) return false;

      return true;
    });
  }, [items, searchTerm, categoryFilter, archetypeFilter, statusFilter]);

  // Reset pagination on filter change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchTerm, archetypeFilter, categoryFilter, statusFilter]);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredItems.length));
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [filteredItems.length]);

  const visibleItems = useMemo(() => {
    return filteredItems.slice(0, visibleCount);
  }, [filteredItems, visibleCount]);

  // Toggle card switch mode (Active -> Total -> Inactive -> Active)
  const toggleCardMode = (archKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCardFilterModes((prev) => {
      const current = prev[archKey] || "active";
      const next = current === "active" ? "total" : current === "total" ? "inactive" : "active";
      return { ...prev, [archKey]: next };
    });
  };

  const handleCardClick = (archKey: EventArchetypeKey) => {
    setArchetypeFilter((prev) => (prev === archKey ? "all" : archKey));
  };

  // Helper date/time formatters
  const formatDateString = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleString("es-AR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <h1 className="font-heading text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
            Catálogo de Eventos
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Explora, modera y gestiona todos los eventos y lugares registrados en la plataforma DateBox ({items.length} registros).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => refetch()} isLoading={isLoading}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* KPI Top Metric Cards with Switchable Modes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total General */}
        <div
          onClick={() => {
            setArchetypeFilter("all");
            setStatusFilter("all");
          }}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 ${
            archetypeFilter === "all"
              ? "border-zinc-900 dark:border-zinc-100 bg-zinc-900 text-white shadow-md"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${archetypeFilter === "all" ? "text-zinc-300" : "text-zinc-500 dark:text-zinc-400"}`}>
              Catálogo Total
            </span>
            <Compass className={`w-4 h-4 ${archetypeFilter === "all" ? "text-zinc-200" : "text-zinc-400"}`} />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black tracking-tight font-heading">{metrics.total}</span>
            <span className={`text-xs font-semibold ${archetypeFilter === "all" ? "text-emerald-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {metrics.active} activos
            </span>
          </div>
          <p className={`text-[11px] mt-1 truncate ${archetypeFilter === "all" ? "text-zinc-300" : "text-zinc-400"}`}>
            Todos los eventos y lugares
          </p>
        </div>

        {/* Card 2: Eventos Culturales */}
        <ArchetypeKpiCard
          title="Culturales / Públicos"
          icon={Landmark}
          archKey="cultural_event"
          data={metrics.cultural_event}
          mode={cardFilterModes.cultural_event}
          isSelected={archetypeFilter === "cultural_event"}
          colorClass="text-amber-500"
          onClick={() => handleCardClick("cultural_event")}
          onToggleMode={(e) => toggleCardMode("cultural_event", e)}
        />

        {/* Card 3: Eventos Comerciales */}
        <ArchetypeKpiCard
          title="Eventos Comerciales"
          icon={PartyPopper}
          archKey="commercial_event"
          data={metrics.commercial_event}
          mode={cardFilterModes.commercial_event}
          isSelected={archetypeFilter === "commercial_event"}
          colorClass="text-purple-500"
          onClick={() => handleCardClick("commercial_event")}
          onToggleMode={(e) => toggleCardMode("commercial_event", e)}
        />

        {/* Card 4: Locales Comerciales */}
        <ArchetypeKpiCard
          title="Locales Comerciales"
          icon={Utensils}
          archKey="commercial_place"
          data={metrics.commercial_place}
          mode={cardFilterModes.commercial_place}
          isSelected={archetypeFilter === "commercial_place"}
          colorClass="text-emerald-500"
          onClick={() => handleCardClick("commercial_place")}
          onToggleMode={(e) => toggleCardMode("commercial_place", e)}
        />

        {/* Card 5: Espacios Públicos */}
        <ArchetypeKpiCard
          title="Espacios Públicos"
          icon={Trees}
          archKey="public_space"
          data={metrics.public_space}
          mode={cardFilterModes.public_space}
          isSelected={archetypeFilter === "public_space"}
          colorClass="text-sky-500"
          onClick={() => handleCardClick("public_space")}
          onToggleMode={(e) => toggleCardMode("public_space", e)}
        />
      </div>

      {/* Filter and View Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900/70 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-subtle">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por título, dirección, venue u organizador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 pl-9 pr-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-400"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Archetype Filter */}
          <select
            value={archetypeFilter}
            onChange={(e) => setArchetypeFilter(e.target.value as EventArchetypeKey)}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none"
          >
            <option value="all">Todos los Tipos de Eventos</option>
            <option value="cultural_event">Culturales / Públicos (Bienal, Ferias)</option>
            <option value="commercial_event">Eventos Comerciales / Shows</option>
            <option value="commercial_place">Locales Comerciales / Bares</option>
            <option value="public_space">Espacios Públicos / Parques</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
          >
            <option value="all">Todas las Categorías ({categories.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
          >
            <option value="all">Todos los Estados</option>
            <option value="active">Activos en App</option>
            <option value="inactive">Inactivos</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-0.5">
            <button
              onClick={() => setViewMode("table")}
              title="Vista en Tabla"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                viewMode === "table"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              Tabla
            </button>
            <button
              onClick={() => setViewMode("grid")}
              title="Vista en Cuadrícula"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                viewMode === "grid"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Cards
            </button>
          </div>
        </div>
      </div>

      {/* Results summary counter */}
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 px-1">
        <span>
          Mostrando <strong>{visibleItems.length}</strong> de <strong>{filteredItems.length}</strong> eventos encontrados
        </span>
        {filteredItems.length < items.length && (
          <button
            onClick={() => {
              setSearchTerm("");
              setArchetypeFilter("all");
              setCategoryFilter("all");
              setStatusFilter("all");
            }}
            className="text-primary hover:underline font-semibold"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* CONTENT: TABLE OR GRID VIEW */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent dark:border-white" />
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="p-16 text-center">
          <Compass className="mx-auto h-12 w-12 text-zinc-400 mb-3 opacity-40" />
          <h3 className="font-heading text-base font-bold text-zinc-900 dark:text-zinc-100">
            No se encontraron eventos o lugares
          </h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Prueba ajustando los términos de búsqueda o los filtros de tipo de evento y categoría.
          </p>
        </Card>
      ) : viewMode === "table" ? (
        /* ------------------ TABLE VIEW ------------------ */
        <div className="space-y-4">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Título & Local</TableHeaderCell>
                <TableHeaderCell>Categoría</TableHeaderCell>
                <TableHeaderCell>Tipo de Evento</TableHeaderCell>
                <TableHeaderCell>Ubicación / Fechas</TableHeaderCell>
                <TableHeaderCell>Estado</TableHeaderCell>
                <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleItems.map((item) => {
                const arch = getEventArchetype(item);
                const coverImage = item.image_urls?.[0] || item.image_url;

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {coverImage ? (
                          <img
                            src={coverImage}
                            alt={item.title}
                            className="h-11 w-11 rounded-xl object-cover shrink-0 border border-zinc-200 dark:border-zinc-800"
                          />
                        ) : (
                          <div className="h-11 w-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-200 dark:border-zinc-800">
                            <arch.icon className="w-5 h-5 text-zinc-400" />
                          </div>
                        )}
                        <div className="min-w-0 max-w-[280px]">
                          <div className="font-bold text-zinc-900 dark:text-zinc-50 truncate" title={item.title}>
                            {item.title}
                          </div>
                          <div className="text-[11px] text-zinc-400 truncate">
                            {item.venue_name || item.organizer_name || "Sin organizador"}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="purple">{item.category}</Badge>
                    </TableCell>

                    <TableCell>
                      <Badge variant={arch.badgeVariant} className="font-semibold gap-1">
                        <arch.icon className="w-3 h-3" />
                        {arch.shortLabel}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-xs text-zinc-500 max-w-[220px]">
                      {item.is_temporary && item.starts_at ? (
                        <div className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="truncate">{formatDateString(item.starts_at)}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-zinc-500 truncate" title={item.address || ""}>
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{item.address || "Sin dirección"}</span>
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge variant={item.status ? "success" : "danger"}>
                        {item.status ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedItem(item);
                          setShowRawMetadata(false);
                        }}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Ver Ficha
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* ------------------ GRID CARDS VIEW ------------------ */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {visibleItems.map((item) => {
            const arch = getEventArchetype(item);
            const coverImage = item.image_urls?.[0] || item.image_url;

            return (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedItem(item);
                  setShowRawMetadata(false);
                }}
                className="group cursor-pointer rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 overflow-hidden shadow-subtle hover:shadow-card hover:border-zinc-400 dark:hover:border-zinc-700 transition-all flex flex-col"
              >
                {/* Card Cover Image */}
                <div className="relative h-40 bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  {coverImage ? (
                    <img
                      src={coverImage}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                      <arch.icon className="w-10 h-10 opacity-40" />
                    </div>
                  )}

                  {/* Status Indicator Pill */}
                  <div
                    className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-md border ${
                      item.status
                        ? "bg-emerald-500/90 text-white border-emerald-400"
                        : "bg-zinc-800/90 text-zinc-300 border-zinc-700"
                    }`}
                  >
                    {item.status ? "Activo" : "Inactivo"}
                  </div>

                  {/* Archetype Icon Badge */}
                  <div className="absolute top-2.5 right-2.5 p-1.5 rounded-xl bg-black/60 backdrop-blur-md text-white">
                    <arch.icon className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    {/* Tags / Archetype */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="purple" className="text-[10px]">
                        {item.category}
                      </Badge>
                      <Badge variant={arch.badgeVariant} className="text-[10px]">
                        {arch.shortLabel}
                      </Badge>
                    </div>

                    {/* Title */}
                    <h3 className="font-heading font-bold text-sm text-zinc-900 dark:text-zinc-50 line-clamp-2 leading-tight">
                      {item.title}
                    </h3>

                    {/* Venue / Organizer */}
                    {(item.venue_name || item.organizer_name) && (
                      <p className="text-[11px] text-zinc-400 truncate">
                        {item.venue_name || item.organizer_name}
                      </p>
                    )}
                  </div>

                  {/* Meta info bottom */}
                  <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
                    {item.is_temporary && item.starts_at ? (
                      <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="truncate">{formatDateString(item.starts_at)}</span>
                      </div>
                    ) : item.address ? (
                      <div className="flex items-center gap-1.5 text-[11px] truncate">
                        <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="truncate">{item.address}</span>
                      </div>
                    ) : null}

                    {item.ticket_price != null && item.ticket_price > 0 && (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <DollarSign className="w-3 h-3" />
                        ${item.ticket_price.toLocaleString("es-AR")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Infinite Scroll Trigger / Load More Button */}
      {visibleCount < filteredItems.length && (
        <div ref={loadMoreRef} className="flex justify-center py-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredItems.length))}
          >
            Cargar más eventos ({filteredItems.length - visibleCount} restantes)
          </Button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DETAIL MODAL: FICHA COMPLETA DEL EVENTO                         */}
      {/* ------------------------------------------------------------- */}
      {selectedItem && (
        <Modal
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          title={selectedItem.title}
          description={`ID: ${selectedItem.id}`}
          size="lg"
        >
          {(() => {
            const arch = getEventArchetype(selectedItem);
            const images = selectedItem.image_urls?.length
              ? selectedItem.image_urls
              : selectedItem.image_url
              ? [selectedItem.image_url]
              : [];

            return (
              <div className="space-y-6 text-xs max-h-[78vh] overflow-y-auto pr-1">
                {/* Images Gallery */}
                {images.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`${selectedItem.title} ${idx + 1}`}
                        className="h-44 w-full rounded-xl object-cover border border-zinc-200 dark:border-zinc-800"
                      />
                    ))}
                  </div>
                )}

                {/* Archetype Banner Card */}
                <div className={`rounded-2xl border p-4 ${arch.colorClass}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-heading font-black text-sm">
                      <arch.icon className="w-4 h-4 shrink-0" />
                      <span>{arch.label}</span>
                    </div>
                    <Badge variant={selectedItem.status ? "success" : "danger"}>
                      {selectedItem.status ? "Activo en App" : "Inactivo"}
                    </Badge>
                  </div>
                  <p className="text-[11px] mt-1 opacity-90">{arch.description}</p>
                </div>

                {/* Primary Relevant Fields Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Category & Archetype info */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/50 dark:bg-zinc-900/40">
                    <span className="text-zinc-400 block uppercase font-bold text-[10px]">Categoría</span>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="purple">{selectedItem.category}</Badge>
                      {selectedItem.is_commercial && <Badge variant="default">Comercial</Badge>}
                    </div>
                  </div>

                  {/* Location & Venue */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/50 dark:bg-zinc-900/40">
                    <span className="text-zinc-400 block uppercase font-bold text-[10px]">Lugar / Venue</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 block mt-1">
                      {selectedItem.venue_name || selectedItem.organizer_name || "No especificado"}
                    </span>
                  </div>

                  {/* Dirección */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/50 dark:bg-zinc-900/40">
                    <span className="text-zinc-400 block uppercase font-bold text-[10px]">Dirección</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 block mt-1">
                      {selectedItem.address || "Sin dirección registrada"}
                    </span>
                  </div>

                  {/* Dates for Temporary Events */}
                  {selectedItem.is_temporary ? (
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/50 dark:bg-zinc-900/40">
                      <span className="text-zinc-400 block uppercase font-bold text-[10px]">Vigencia del Evento</span>
                      <div className="mt-1 space-y-0.5">
                        <div className="text-zinc-800 dark:text-zinc-200 font-medium">
                          <strong>Inicio:</strong> {formatDateString(selectedItem.starts_at) || "N/A"}
                        </div>
                        {selectedItem.ends_at && (
                          <div className="text-zinc-800 dark:text-zinc-200 font-medium">
                            <strong>Fin:</strong> {formatDateString(selectedItem.ends_at)}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Price / Rating */
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/50 dark:bg-zinc-900/40">
                      <span className="text-zinc-400 block uppercase font-bold text-[10px]">Rating & Precio</span>
                      <div className="flex items-center gap-3 mt-1 font-semibold">
                        {selectedItem.rating > 0 && (
                          <span className="flex items-center gap-1 text-amber-500">
                            <Star className="w-3.5 h-3.5 fill-amber-500" />
                            {selectedItem.rating.toFixed(1)}
                          </span>
                        )}
                        <span>
                          {selectedItem.ticket_price != null && selectedItem.ticket_price > 0
                            ? `$${selectedItem.ticket_price.toLocaleString("es-AR")}`
                            : "Acceso Libre"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Horarios Breakdown (if available) */}
                {selectedItem.horarios && Array.isArray(selectedItem.horarios) && selectedItem.horarios.length > 0 && (
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3.5 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-2">
                    <span className="text-zinc-400 block uppercase font-bold text-[10px]">
                      Franjas Horarias Registradas (`horarios`)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedItem.horarios.map((h: any, idx: number) => {
                        const days = (h.days_of_week || []).map((d: number) => DAYS_NAMES[d] || d).join(", ");
                        return (
                          <div key={idx} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-2 bg-white dark:bg-zinc-950 text-[11px]">
                            <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                              <span>{h.descripcion || `Turno ${idx + 1}`}</span>
                              <span className="text-primary">{h.start} - {h.end} hs</span>
                            </div>
                            <div className="text-zinc-400 text-[10px] mt-0.5">
                              Días: {days || "Todos los días"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedItem.description && (
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3.5 bg-zinc-50/50 dark:bg-zinc-900/40">
                    <span className="text-zinc-400 block uppercase font-bold text-[10px] mb-1">Descripción</span>
                    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">{selectedItem.description}</p>
                  </div>
                )}

                {/* Maps & Scraper external links */}
                <div className="flex flex-wrap gap-2">
                  {selectedItem.google_maps_url && (
                    <a
                      href={selectedItem.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <MapPin className="w-3.5 h-3.5 text-red-500" />
                      Ver en Google Maps
                      <ExternalLink className="w-3 h-3 text-zinc-400" />
                    </a>
                  )}

                  {selectedItem.external_url && (
                    <a
                      href={selectedItem.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                      Enlace de origen / Scraper
                    </a>
                  )}
                </div>

                {/* ------------------------------------------------------------- */}
                {/* EXPANDABLE ACCORDION: "Ver el resto de campos" (RAW METADATA) */}
                {/* ------------------------------------------------------------- */}
                <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowRawMetadata((prev) => !prev)}
                    className="w-full flex items-center justify-between py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/50 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
                      Ver el resto de campos (Metadatos completos de BD)
                    </span>
                    {showRawMetadata ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showRawMetadata && (
                    <div className="mt-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-[11px] space-y-2">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        <div><strong className="text-zinc-400">id:</strong> {selectedItem.id}</div>
                        <div><strong className="text-zinc-400">owner_id:</strong> {selectedItem.owner_id || "NULL"}</div>
                        <div><strong className="text-zinc-400">is_temporary:</strong> {String(selectedItem.is_temporary)}</div>
                        <div><strong className="text-zinc-400">is_commercial:</strong> {String(selectedItem.is_commercial)}</div>
                        <div><strong className="text-zinc-400">status (is_active):</strong> {String(selectedItem.status)}</div>
                        <div><strong className="text-zinc-400">promotion_score:</strong> {selectedItem.promotion_score}</div>
                        <div><strong className="text-zinc-400">google_place_id:</strong> {selectedItem.google_place_id || "NULL"}</div>
                        <div><strong className="text-zinc-400">latitude:</strong> {selectedItem.latitude ?? "NULL"}</div>
                        <div><strong className="text-zinc-400">longitude:</strong> {selectedItem.longitude ?? "NULL"}</div>
                        <div><strong className="text-zinc-400">duration_hours:</strong> {selectedItem.duration_hours ?? "NULL"}</div>
                        <div><strong className="text-zinc-400">open_time:</strong> {selectedItem.open_time || "NULL"}</div>
                        <div><strong className="text-zinc-400">close_time:</strong> {selectedItem.close_time || "NULL"}</div>
                        <div><strong className="text-zinc-400">created_at:</strong> {selectedItem.created_at}</div>
                        <div><strong className="text-zinc-400">updated_at:</strong> {selectedItem.updated_at || "NULL"}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <Button
                    variant={selectedItem.status ? "danger" : "success"}
                    size="sm"
                    isLoading={toggleStatusMutation.isPending}
                    onClick={() =>
                      toggleStatusMutation.mutate({
                        id: selectedItem.id,
                        newStatus: !selectedItem.status,
                      })
                    }
                  >
                    {selectedItem.status ? "Desactivar en la App" : "Activar en la App"}
                  </Button>

                  <Button variant="ghost" size="sm" onClick={() => setSelectedItem(null)}>
                    Cerrar
                  </Button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Helper Component: Switchable Archetype KPI Card
// -------------------------------------------------------------
interface ArchetypeKpiCardProps {
  title: string;
  icon: React.ElementType;
  archKey: string;
  data: { total: number; active: number; inactive: number };
  mode: "active" | "total" | "inactive";
  isSelected: boolean;
  colorClass: string;
  onClick: () => void;
  onToggleMode: (e: React.MouseEvent) => void;
}

function ArchetypeKpiCard({
  title,
  icon: Icon,
  data,
  mode,
  isSelected,
  colorClass,
  onClick,
  onToggleMode,
}: ArchetypeKpiCardProps) {
  const displayValue = mode === "active" ? data.active : mode === "total" ? data.total : data.inactive;
  const displayLabel = mode === "active" ? "Activos" : mode === "total" ? "Total" : "Inactivos";

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 backdrop-blur-sm ${
        isSelected
          ? "border-zinc-900 dark:border-zinc-100 bg-zinc-900 text-white shadow-md"
          : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-400"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-bold uppercase tracking-wider truncate ${isSelected ? "text-zinc-300" : "text-zinc-500 dark:text-zinc-400"}`}>
          {title}
        </span>
        <Icon className={`w-4 h-4 shrink-0 ${isSelected ? "text-white" : colorClass}`} />
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-2xl font-black tracking-tight font-heading">{displayValue}</span>

        {/* Mode switcher button */}
        <button
          type="button"
          onClick={onToggleMode}
          title="Click para alternar entre Activos, Total e Inactivos"
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
            isSelected
              ? "border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              : mode === "active"
              ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
              : mode === "total"
              ? "border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
              : "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
          }`}
        >
          {displayLabel} ⇄
        </button>
      </div>

      <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-400">
        <span>Total: {data.total}</span>
        <span className="text-emerald-500">{data.active} activos</span>
      </div>
    </div>
  );
}
