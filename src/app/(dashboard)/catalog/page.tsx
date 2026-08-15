"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { StatCard } from "@/components/ui/StatCard";
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
} from "lucide-react";

interface CatalogItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  is_temporary: boolean;
  status: boolean;
  image_urls: string[] | null;
  venue_name: string | null;
  created_at: string;
  tags?: { name: string }[];
}

export default function CatalogPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "place" | "event">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);

  // Fetch Events / Places from DB
  const { data: items = [], isLoading, refetch } = useQuery<CatalogItem[]>({
    queryKey: ["admin-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(`
          id,
          title,
          description,
          category,
          address,
          latitude,
          longitude,
          is_temporary,
          status,
          image_urls,
          venue_name,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as any) || [];
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: boolean }) => {
      const { error } = await supabase
        .from("events")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-catalog"] });
      if (selectedItem) {
        setSelectedItem((prev) => prev ? { ...prev, status: !prev.status } : null);
      }
    },
  });

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category).filter(Boolean));
    return Array.from(set).sort();
  }, [items]);

  // Filtering
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = searchTerm.trim().toLowerCase();
      const text = [item.title, item.description, item.category, item.address, item.venue_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (q && !text.includes(q)) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (typeFilter === "place" && item.is_temporary) return false;
      if (typeFilter === "event" && !item.is_temporary) return false;
      if (statusFilter === "active" && !item.status) return false;
      if (statusFilter === "inactive" && item.status) return false;

      return true;
    });
  }, [items, searchTerm, categoryFilter, typeFilter, statusFilter]);

  // Stats
  const totalCount = items.length;
  const activeCount = items.filter((i) => i.status).length;
  const placesCount = items.filter((i) => !i.is_temporary).length;
  const eventsCount = items.filter((i) => i.is_temporary).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <h1 className="font-heading text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
            Catálogo de Lugares y Eventos
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Explora, filtra y modera todos los lugares permanentes y eventos temporales de DateBox.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => refetch()} isLoading={isLoading}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Actualizar
        </Button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Total Registros" value={totalCount} icon={<Compass className="w-4 h-4" />} />
        <StatCard title="Activos en App" value={activeCount} icon={<CheckCircle className="w-4 h-4 text-emerald-500" />} variant="success" />
        <StatCard title="Locales / Lugares" value={placesCount} icon={<Store className="w-4 h-4 text-purple-500" />} />
        <StatCard title="Eventos Temporales" value={eventsCount} icon={<Calendar className="w-4 h-4 text-amber-500" />} />
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-zinc-900/60 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por título, dirección o categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 pl-9 pr-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
        >
          <option value="all">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
        >
          <option value="all">Todos los tipos</option>
          <option value="place">Solo Locales / Fijos</option>
          <option value="event">Solo Eventos Temporales</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      {/* Content Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent dark:border-white" />
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="p-12 text-center">
          <Compass className="mx-auto h-10 w-10 text-zinc-400 mb-2 opacity-50" />
          <h3 className="font-heading font-bold text-zinc-900 dark:text-zinc-100">Sin resultados</h3>
          <p className="text-xs text-zinc-500 mt-1">Ajusta los filtros de búsqueda o agrega un nuevo evento.</p>
        </Card>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Título & Local</TableHeaderCell>
              <TableHeaderCell>Categoría</TableHeaderCell>
              <TableHeaderCell>Tipo</TableHeaderCell>
              <TableHeaderCell>Dirección</TableHeaderCell>
              <TableHeaderCell>Estado</TableHeaderCell>
              <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {item.image_urls && item.image_urls.length > 0 ? (
                      <img
                        src={item.image_urls[0]}
                        alt={item.title}
                        className="h-10 w-10 rounded-lg object-cover shrink-0 border border-zinc-200 dark:border-zinc-800"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                        <Store className="w-5 h-5 text-zinc-400" />
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-zinc-900 dark:text-zinc-50">{item.title}</div>
                      <div className="text-[11px] text-zinc-400">{item.venue_name || "Lugar sin nombre"}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="purple">{item.category}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={item.is_temporary ? "warning" : "default"}>
                    {item.is_temporary ? "Evento" : "Local"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-zinc-500 max-w-[200px] truncate">
                  {item.address || "Sin dirección"}
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
                    onClick={() => setSelectedItem(item)}
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    Ver Ficha
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* DETAIL MODAL */}
      {selectedItem && (
        <Modal
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          title={selectedItem.title}
          description={`ID: ${selectedItem.id}`}
          size="lg"
        >
          <div className="space-y-5">
            {/* Images gallery */}
            {selectedItem.image_urls && selectedItem.image_urls.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {selectedItem.image_urls.map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt={`${selectedItem.title} ${idx}`}
                    className="h-44 w-full rounded-xl object-cover border border-zinc-200 dark:border-zinc-800"
                  />
                ))}
              </div>
            )}

            {/* Info details */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/50 dark:bg-zinc-900/40">
                <span className="text-zinc-400 block uppercase font-bold text-[10px]">Categoría & Tipo</span>
                <div className="flex gap-2 mt-1">
                  <Badge variant="purple">{selectedItem.category}</Badge>
                  <Badge variant={selectedItem.is_temporary ? "warning" : "default"}>
                    {selectedItem.is_temporary ? "Evento Temporal" : "Local Permanente"}
                  </Badge>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/50 dark:bg-zinc-900/40">
                <span className="text-zinc-400 block uppercase font-bold text-[10px]">Ubicación</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 block mt-1">
                  {selectedItem.address || "N/A"}
                </span>
                {selectedItem.latitude && selectedItem.longitude && (
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Coords: {selectedItem.latitude}, {selectedItem.longitude}
                  </span>
                )}
              </div>
            </div>

            {selectedItem.description && (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/50 dark:bg-zinc-900/40 text-xs">
                <span className="text-zinc-400 block uppercase font-bold text-[10px] mb-1">Descripción</span>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">{selectedItem.description}</p>
              </div>
            )}

            {/* Actions */}
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
        </Modal>
      )}
    </div>
  );
}
