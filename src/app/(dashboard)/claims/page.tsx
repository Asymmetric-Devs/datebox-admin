"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import {
  Store,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Search,
  RefreshCw,
  Building,
  User,
  Phone,
  Mail,
  MapPin,
  Tag,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface ClaimItem {
  id: number;
  business_id: string;
  event_id: string;
  status: "pending" | "approved" | "rejected";
  documentation_url: string | null;
  created_at: string;
  reviewed_at: string | null;
  business: {
    id: string;
    name_business: string;
    name_owner: string;
    cuit: string;
    phone: string;
    mail: string;
  } | null;
  event: {
    id: string;
    title: string;
    address: string | null;
    category: string;
    image_urls: string[];
  } | null;
}

export default function ClaimsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedClaim, setSelectedClaim] = useState<ClaimItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch Claims
  const { data: claims = [], isLoading, refetch } = useQuery<ClaimItem[]>({
    queryKey: ["admin-claims"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_claim_event")
        .select(`
          id,
          business_id,
          event_id,
          status,
          documentation_url,
          created_at,
          reviewed_at,
          business:businesses (
            id,
            name_business,
            name_owner,
            cuit,
            phone,
            mail
          ),
          event:events (
            id,
            title,
            address,
            category,
            image_urls
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as any) || [];
    },
  });

  // Mutation to Review Claim
  const reviewMutation = useMutation({
    mutationFn: async ({ claimId, status }: { claimId: number; status: "approved" | "rejected" }) => {
      const claim = claims.find((c) => c.id === claimId);
      if (!claim) throw new Error("Reclamo no encontrado");

      // 1. Update claim status
      const { error: claimError } = await supabase
        .from("business_claim_event")
        .update({
          status,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", claimId);

      if (claimError) throw claimError;

      // 2. If approved, associate business with event
      if (status === "approved" && claim.event_id && claim.business_id) {
        const { error: eventError } = await supabase
          .from("events")
          .update({ business_id: claim.business_id })
          .eq("id", claim.event_id);

        if (eventError) {
          console.error("Error linking event with business:", eventError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-claims"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-claims-stats"] });
      setIsModalOpen(false);
      setSelectedClaim(null);
    },
    onError: (err: any) => {
      setActionError(err.message || "Error al procesar el reclamo");
    },
  });

  // Open Document with Signed URL
  const handleOpenDoc = async (docUrl: string | null) => {
    if (!docUrl) return;
    try {
      const { data, error } = await supabase.storage
        .from("business_claims_events_proofs")
        .createSignedUrl(docUrl, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (err: any) {
      setActionError("No se pudo generar el enlace seguro al comprobante PDF");
    }
  };

  const filteredClaims = claims.filter((claim) => {
    const bName = claim.business?.name_business?.toLowerCase() || "";
    const oName = claim.business?.name_owner?.toLowerCase() || "";
    const eTitle = claim.event?.title?.toLowerCase() || "";
    const cuit = claim.business?.cuit || "";
    const q = searchTerm.toLowerCase();

    const matchesSearch = !q || bName.includes(q) || oName.includes(q) || eTitle.includes(q) || cuit.includes(q);
    const matchesStatus = statusFilter === "all" || claim.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: ClaimItem["status"]) => {
    switch (status) {
      case "approved":
        return <Badge variant="success"><CheckCircle2 className="w-3 h-3" /> Aprobado</Badge>;
      case "rejected":
        return <Badge variant="danger"><XCircle className="w-3 h-3" /> Rechazado</Badge>;
      default:
        return <Badge variant="warning"><Clock className="w-3 h-3" /> Pendiente</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <h1 className="font-heading text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
            Moderación de Reclamos
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Verifica y autoriza reclamos de titularidad de locales presentados por comercios.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} isLoading={isLoading}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Actualizar
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por negocio, dueño, local o CUIT..."
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
          <option value="pending">Pendientes</option>
          <option value="approved">Aprobados</option>
          <option value="rejected">Rechazados</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent dark:border-white" />
        </div>
      ) : filteredClaims.length === 0 ? (
        <Card className="p-12 text-center">
          <Store className="mx-auto h-10 w-10 text-zinc-400 mb-2 opacity-50" />
          <h3 className="font-heading font-bold text-zinc-900 dark:text-zinc-100">No hay solicitudes</h3>
          <p className="text-xs text-zinc-500 mt-1">No se encontraron reclamos con los filtros actuales.</p>
        </Card>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Comercio / Negocio</TableHeaderCell>
              <TableHeaderCell>Dueño Solicitante</TableHeaderCell>
              <TableHeaderCell>Local / Evento</TableHeaderCell>
              <TableHeaderCell>CUIT</TableHeaderCell>
              <TableHeaderCell>Fecha</TableHeaderCell>
              <TableHeaderCell>Estado</TableHeaderCell>
              <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredClaims.map((claim) => (
              <TableRow key={claim.id}>
                <TableCell>
                  <div className="font-bold text-zinc-900 dark:text-zinc-50">
                    {claim.business?.name_business || "N/A"}
                  </div>
                  <div className="text-[11px] text-zinc-400">{claim.business?.mail || ""}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-zinc-800 dark:text-zinc-200">
                    {claim.business?.name_owner || "N/A"}
                  </div>
                  <div className="text-[11px] text-zinc-400">{claim.business?.phone || ""}</div>
                </TableCell>
                <TableCell>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {claim.event?.title || "Evento no encontrado"}
                  </div>
                  <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                    {claim.event?.category || ""}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{claim.business?.cuit || "N/A"}</TableCell>
                <TableCell className="text-xs text-zinc-500">{formatDate(claim.created_at)}</TableCell>
                <TableCell>{getStatusBadge(claim.status)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedClaim(claim);
                      setActionError(null);
                      setIsModalOpen(true);
                    }}
                  >
                    Ver Detalle
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Detail & Moderation Modal */}
      {selectedClaim && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`Solicitud de Reclamo #${selectedClaim.id}`}
          description={`Creada el ${formatDate(selectedClaim.created_at)}`}
          size="lg"
        >
          <div className="space-y-6">
            {actionError && (
              <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 p-3 text-xs text-red-600 dark:text-red-400">
                {actionError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Business Info Card */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3 bg-zinc-50/50 dark:bg-zinc-900/40">
                <div className="flex items-center gap-2 font-heading font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  <Building className="w-4 h-4 text-purple-500" />
                  Datos del Comercio
                </div>
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-zinc-400 block text-[10px] uppercase font-bold">Razón Social</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{selectedClaim.business?.name_business || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px] uppercase font-bold">Titular / Dueño</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{selectedClaim.business?.name_owner || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px] uppercase font-bold">CUIT</span>
                    <span className="font-mono text-zinc-800 dark:text-zinc-200">{selectedClaim.business?.cuit || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px] uppercase font-bold">Contacto</span>
                    <span className="text-zinc-800 dark:text-zinc-200">{selectedClaim.business?.phone} · {selectedClaim.business?.mail}</span>
                  </div>
                </div>
              </div>

              {/* Event Info Card */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3 bg-zinc-50/50 dark:bg-zinc-900/40">
                <div className="flex items-center gap-2 font-heading font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  <Store className="w-4 h-4 text-purple-500" />
                  Local Solicitado
                </div>
                {selectedClaim.event ? (
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-zinc-400 block text-[10px] uppercase font-bold">Nombre del Local</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{selectedClaim.event.title}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block text-[10px] uppercase font-bold">Dirección</span>
                      <span className="text-zinc-800 dark:text-zinc-200">{selectedClaim.event.address || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block text-[10px] uppercase font-bold">Categoría</span>
                      <Badge variant="purple" className="mt-0.5">{selectedClaim.event.category}</Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400">ID del evento solicitado: {selectedClaim.event_id}</p>
                )}
              </div>
            </div>

            {/* Proof Document Section */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/40">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-zinc-200 dark:bg-zinc-800 p-2.5">
                  <FileText className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Comprobante de Titularidad / CUIT</h4>
                  <p className="text-[11px] text-zinc-400">Documento PDF subido por el titular para validar legitimación.</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenDoc(selectedClaim.documentation_url)}
                disabled={!selectedClaim.documentation_url}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                Abrir PDF
              </Button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
                Cerrar
              </Button>
              {selectedClaim.status === "pending" && (
                <>
                  <Button
                    variant="danger"
                    size="sm"
                    isLoading={reviewMutation.isPending}
                    onClick={() => reviewMutation.mutate({ claimId: selectedClaim.id, status: "rejected" })}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Rechazar
                  </Button>
                  <Button
                    variant="success"
                    size="sm"
                    isLoading={reviewMutation.isPending}
                    onClick={() => reviewMutation.mutate({ claimId: selectedClaim.id, status: "approved" })}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Aprobar y Vincular
                  </Button>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
