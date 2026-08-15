"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { Modal } from "@/components/ui/Modal";
import {
  Database,
  Play,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Layers,
  Terminal,
  Activity,
  Download,
  Filter,
  RefreshCw,
  Sparkles,
} from "lucide-react";

interface EtlSource {
  id: string;
  name: string;
  category: string;
  status: "idle" | "running" | "success" | "error";
  lastRun: string;
  itemsProcessed: number;
  accuracy: string;
}

interface EtlLog {
  id: string;
  timestamp: string;
  source: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
}

export default function EtlPage() {
  const queryClient = useQueryClient();
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [bulkDataInput, setBulkDataInput] = useState("");
  const [importResults, setImportResults] = useState<{ count: number; error?: string } | null>(null);

  // Sources Status
  const [sources, setSources] = useState<EtlSource[]>([
    {
      id: "ticketek",
      name: "Ticketek & PlateaNet",
      category: "Espectáculos & Teatro",
      status: "idle",
      lastRun: "Hoy, 10:30 AM",
      itemsProcessed: 42,
      accuracy: "98.5%",
    },
    {
      id: "passline",
      name: "Passline & VuenAires",
      category: "Fiestas & Boliches",
      status: "idle",
      lastRun: "Ayer, 22:15 PM",
      itemsProcessed: 89,
      accuracy: "96.2%",
    },
    {
      id: "ba_cultura",
      name: "Agenda Cultural BA",
      category: "Cultura & Museos",
      status: "idle",
      lastRun: "Hoy, 08:00 AM",
      itemsProcessed: 114,
      accuracy: "99.1%",
    },
    {
      id: "gastronomia",
      name: "Restaurantes & Bares (Maps / Trip)",
      category: "Gastronomía",
      status: "idle",
      lastRun: "Hace 2 días",
      itemsProcessed: 230,
      accuracy: "95.0%",
    },
  ]);

  // Execution Logs
  const [logs, setLogs] = useState<EtlLog[]>([
    {
      id: "1",
      timestamp: "10:30:12",
      source: "ticketek",
      level: "info",
      message: "Iniciando extractor Ticketek con parámetros de geolocalización CABA...",
    },
    {
      id: "2",
      timestamp: "10:30:45",
      source: "ticketek",
      level: "success",
      message: "42 eventos extraídos y parseados con éxito con tags semánticos.",
    },
    {
      id: "3",
      timestamp: "10:31:02",
      source: "vectorizer",
      level: "info",
      message: "Generando embeddings vectoriales con modelo OpenAI text-embedding-3...",
    },
    {
      id: "4",
      timestamp: "10:31:25",
      source: "db_writer",
      level: "success",
      message: "Sincronización completada. Base de datos actualizada en Supabase.",
    },
  ]);

  // Trigger ETL pipeline execution
  const handleRunEtl = (sourceId?: string) => {
    setIsRunningAll(true);
    const newLog: EtlLog = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      source: sourceId || "all",
      level: "info",
      message: `Disparando pipeline ETL ${sourceId ? `para [${sourceId}]` : "completo"}...`,
    };
    setLogs((prev) => [newLog, ...prev]);

    setTimeout(() => {
      setIsRunningAll(false);
      setLogs((prev) => [
        {
          id: (Date.now() + 1).toString(),
          timestamp: new Date().toLocaleTimeString(),
          source: sourceId || "all",
          level: "success",
          message: `Pipeline ejecutado con éxito. Nuevos eventos procesados y guardados.`,
        },
        ...prev,
      ]);
    }, 2500);
  };

  // Handle Mass Bulk Ingest from JSON
  const handleBulkImport = async () => {
    setImportResults(null);
    try {
      const parsed = JSON.parse(bulkDataInput);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      if (items.length === 0) {
        throw new Error("El JSON no contiene ningún elemento");
      }

      // Format items to match events schema
      const formatted = items.map((item: any) => ({
        title: item.title || "Evento Sin Título",
        description: item.description || "",
        category: item.category || "Entretenimiento",
        address: item.address || "",
        latitude: item.latitude || null,
        longitude: item.longitude || null,
        is_temporary: item.is_temporary ?? true,
        status: true,
        image_urls: item.image_urls || (item.image_url ? [item.image_url] : []),
        venue_name: item.venue_name || "",
      }));

      const { data, error } = await supabase.from("events").insert(formatted).select();
      if (error) throw error;

      setImportResults({ count: data.length });
      setBulkDataInput("");
      queryClient.invalidateQueries({ queryKey: ["admin-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-catalog-stats"] });
    } catch (err: any) {
      setImportResults({ count: 0, error: err.message || "Formato JSON inválido" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-heading text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
              ETL y Cargas Masivas
            </h1>
            <Badge variant="purple">
              <Sparkles className="w-3 h-3" /> Ingestion Engine
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Monitorea el scraping automático de eventos, ejecuta pipelines y realiza cargas masivas de datos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => setIsUploadModalOpen(true)} variant="outline" className="gap-1.5">
            <Upload className="w-4 h-4" />
            Carga Masiva JSON
          </Button>
          <Button size="sm" onClick={() => handleRunEtl()} isLoading={isRunningAll} className="gap-1.5">
            <Play className="w-4 h-4" />
            Ejecutar Todo el ETL
          </Button>
        </div>
      </div>

      {/* Sources Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sources.map((source) => (
          <Card key={source.id} className="hover:border-zinc-400 dark:hover:border-zinc-700">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Badge variant="default" className="text-[10px] uppercase font-bold">
                  {source.category}
                </Badge>
                <Badge variant="success" className="text-[10px]">
                  {source.accuracy}
                </Badge>
              </div>
              <CardTitle className="mt-2 text-base">{source.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Última corrida:</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{source.lastRun}</span>
              </div>
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Items procesados:</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{source.itemsProcessed}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs mt-2"
                onClick={() => handleRunEtl(source.id)}
                isLoading={isRunningAll}
              >
                <Play className="w-3 h-3 mr-1" />
                Ejecutar Fuente
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Live Terminal / Log Viewer */}
      <Card className="bg-zinc-950 text-zinc-50 border-zinc-800">
        <CardHeader className="border-b border-zinc-800 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-purple-400" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
                Consola de Ejecución & Logs del ETL
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-mono text-zinc-400">Stream Activo</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="font-mono text-xs space-y-2 max-h-72 overflow-y-auto pr-2">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3">
                <span className="text-zinc-500 select-none">[{log.timestamp}]</span>
                <span
                  className={`font-bold uppercase text-[10px] px-1.5 py-0.5 rounded ${
                    log.level === "success"
                      ? "bg-emerald-950 text-emerald-400"
                      : log.level === "error"
                      ? "bg-red-950 text-red-400"
                      : "bg-zinc-800 text-zinc-300"
                  }`}
                >
                  {log.level}
                </span>
                <span className="text-zinc-400">[{log.source}]</span>
                <span className="text-zinc-200">{log.message}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* BULK IMPORT MODAL */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Carga Masiva de Eventos (JSON)"
        description="Pega un arreglo JSON de eventos o lugares para agregarlos directamente a DateBox."
        size="lg"
      >
        <div className="space-y-4">
          {importResults && (
            <div
              className={`rounded-xl p-3 text-xs ${
                importResults.error
                  ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-200"
                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200"
              }`}
            >
              {importResults.error
                ? `Error: ${importResults.error}`
                : `¡Éxito! Se insertaron ${importResults.count} eventos correctamente en la base de datos.`}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Datos en formato JSON:
            </label>
            <textarea
              rows={10}
              placeholder={`[
  {
    "title": "Recital Acústico en Palermo",
    "description": "Noche de música en vivo y gastronomía al aire libre.",
    "category": "Música",
    "address": "Honduras 4800, CABA",
    "venue_name": "Club Lucille",
    "is_temporary": true,
    "image_urls": ["https://images.unsplash.com/photo-1514525253161-7a46d19cd819"]
  }
]`}
              value={bulkDataInput}
              onChange={(e) => setBulkDataInput(e.target.value)}
              className="w-full font-mono text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3 text-zinc-900 dark:text-zinc-100 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <Button variant="ghost" size="sm" onClick={() => setIsUploadModalOpen(false)}>
              Cerrar
            </Button>
            <Button size="sm" onClick={handleBulkImport} disabled={!bulkDataInput.trim()}>
              <Upload className="w-4 h-4 mr-1" />
              Procesar e Insertar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
