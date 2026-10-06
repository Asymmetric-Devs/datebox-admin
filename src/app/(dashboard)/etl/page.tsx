"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Calendar,
  MapPin,
  ExternalLink,
  Edit3,
  Trash2,
  Eye,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Search,
  SlidersHorizontal,
  ShieldAlert,
  Globe,
  Tag,
  ArrowRight,
  Clock,
  Map,
  Copy,
  Info,
  CheckCheck,
} from "lucide-react";

interface EtlSourceInfo {
  id: string;
  name: string;
  category: string;
  city: string;
  description: string;
}

interface EtlStatusData {
  isConfigured: boolean;
  venvPath: string | null;
  pythonVersion: string | null;
  hasEnvFile: boolean;
  etlDir: string;
  availableSources: EtlSourceInfo[];
  lastReportTime: string | null;
  activeJob: boolean;
}

interface NormalizedEventItem {
  source: string;
  external_id: string;
  external_url?: string | null;
  title: string;
  description?: string | null;
  category: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  google_maps_url?: string | null;
  image_urls?: string[];
  is_commercial: boolean;
  is_temporary: boolean;
  is_event?: boolean;
  status?: boolean;
  rating?: number;
  starts_at?: string | null;
  ends_at?: string | null;
  ticket_price?: number | string | null;
  organizer_name?: string | null;
  horarios?: any[];
  tags?: { name: string; description?: string; categories?: string[] }[];
  ai_duplicate_match?: {
    is_duplicate: boolean;
    matched_id?: string | null;
    reason?: string | null;
  } | null;
  db_status?: "new" | "unchanged" | "updated";
  _excluded?: boolean;
}

interface TerminalLog {
  id: string;
  timestamp: string;
  source?: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
}

export default function EtlPage() {
  const queryClient = useQueryClient();

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"step" | "terminal" | "report" | "bulk">("step");

  // Global Config / Filters
  const [selectedCity, setSelectedCity] = useState<"all" | "corrientes" | "resistencia">("all");
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [daysAhead, setDaysAhead] = useState<number>(90);
  const [isDryRun, setIsDryRun] = useState<boolean>(true);
  const [skipAi, setSkipAi] = useState<boolean>(true); // Default TRUE to protect user quota
  const [selectedSources, setSelectedSources] = useState<string[]>([
    "visitcorrientes",
    "corrientes-events",
    "calcuchaco",
  ]);

  // Status Query
  const {
    data: statusData,
    isLoading: isLoadingStatus,
    refetch: refetchStatus,
  } = useQuery<{ success: boolean; data: EtlStatusData }>({
    queryKey: ["etl-status"],
    queryFn: async () => {
      const res = await fetch("/api/etl/status");
      return res.json();
    },
    refetchInterval: 30000,
  });

  // Report Query
  const {
    data: reportData,
    isLoading: isLoadingReport,
    refetch: refetchReport,
  } = useQuery<{ success: boolean; data: { content: string; mtime: string | null; exists: boolean } }>({
    queryKey: ["etl-report"],
    queryFn: async () => {
      const res = await fetch("/api/etl/report");
      return res.json();
    },
  });

  // Streaming Run State
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [runningSourceId, setRunningSourceId] = useState<string | null>(null);
  const [logs, setLogs] = useState<TerminalLog[]>([
    {
      id: "init",
      timestamp: new Date().toLocaleTimeString(),
      level: "info",
      message: "Consola de ETL lista. Configuración cargada desde events-etl/venv.",
    },
  ]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const stepTerminalEndRef = useRef<HTMLDivElement>(null);
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);

  // Step-by-Step Pipeline State
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isStepLoading, setIsStepLoading] = useState<boolean>(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // Extracted data at each stage
  const [extractedEventsBySource, setExtractedEventsBySource] = useState<Record<string, NormalizedEventItem[]>>({});
  const [deduplicatedEventsBySource, setDeduplicatedEventsBySource] = useState<Record<string, NormalizedEventItem[]>>({});
  const [deduplicatedDetails, setDeduplicatedDetails] = useState<any[]>([]);
  const [enrichedEventsBySource, setEnrichedEventsBySource] = useState<Record<string, NormalizedEventItem[]>>({});
  const [aiDuplicatesList, setAiDuplicatesList] = useState<any[]>([]);
  const [previewStats, setPreviewStats] = useState<any>(null);
  const [persistedResults, setPersistedResults] = useState<any>(null);

  // Filter & Search in Review Step
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewCategoryFilter, setReviewCategoryFilter] = useState("all");
  const [editingEvent, setEditingEvent] = useState<{ source: string; index: number; event: NormalizedEventItem } | null>(
    null
  );
  const [inspectingEvent, setInspectingEvent] = useState<NormalizedEventItem | null>(null);

  // Mass Bulk Import State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [bulkDataInput, setBulkDataInput] = useState("");
  const [importResults, setImportResults] = useState<{ count: number; error?: string } | null>(null);
  const [isPersistConfirmOpen, setIsPersistConfirmOpen] = useState(false);

  const ETL_STORAGE_KEY = "datebox_admin_etl_wizard_state_v2";
  const [isRestored, setIsRestored] = useState(false);

  // Restore state from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ETL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.currentStep) setCurrentStep(parsed.currentStep);
        if (parsed.selectedCity) setSelectedCity(parsed.selectedCity);
        if (parsed.startDate) setStartDate(parsed.startDate);
        if (parsed.daysAhead) setDaysAhead(parsed.daysAhead);
        if (typeof parsed.isDryRun === "boolean") setIsDryRun(parsed.isDryRun);
        if (typeof parsed.skipAi === "boolean") setSkipAi(parsed.skipAi);
        if (Array.isArray(parsed.selectedSources) && parsed.selectedSources.length > 0) {
          setSelectedSources(parsed.selectedSources);
        }
        if (parsed.extractedEventsBySource) setExtractedEventsBySource(parsed.extractedEventsBySource);
        if (parsed.deduplicatedEventsBySource) setDeduplicatedEventsBySource(parsed.deduplicatedEventsBySource);
        if (Array.isArray(parsed.deduplicatedDetails)) setDeduplicatedDetails(parsed.deduplicatedDetails);
        if (parsed.enrichedEventsBySource) setEnrichedEventsBySource(parsed.enrichedEventsBySource);
        if (Array.isArray(parsed.aiDuplicatesList)) setAiDuplicatesList(parsed.aiDuplicatesList);
        if (parsed.previewStats) setPreviewStats(parsed.previewStats);
        if (parsed.persistedResults) setPersistedResults(parsed.persistedResults);
        if (Array.isArray(parsed.logs) && parsed.logs.length > 0) setLogs(parsed.logs);
      }
    } catch (e) {
      console.error("Error al restaurar estado del ETL desde localStorage:", e);
    } finally {
      setIsRestored(true);
    }
  }, []);

  // Save state to localStorage on changes
  useEffect(() => {
    if (!isRestored) return;
    try {
      const stateToSave = {
        currentStep,
        selectedCity,
        startDate,
        daysAhead,
        isDryRun,
        skipAi,
        selectedSources,
        extractedEventsBySource,
        deduplicatedEventsBySource,
        deduplicatedDetails,
        enrichedEventsBySource,
        aiDuplicatesList,
        previewStats,
        persistedResults,
        logs: logs.slice(-150),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(ETL_STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.error("Error al guardar estado del ETL en localStorage:", e);
    }
  }, [
    isRestored,
    currentStep,
    selectedCity,
    startDate,
    daysAhead,
    isDryRun,
    skipAi,
    selectedSources,
    extractedEventsBySource,
    deduplicatedEventsBySource,
    deduplicatedDetails,
    enrichedEventsBySource,
    aiDuplicatesList,
    previewStats,
    persistedResults,
    logs,
  ]);

  // Warn user if leaving/refreshing page while ETL is active
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isStepLoading || isRunningAll) {
        e.preventDefault();
        e.returnValue = "Hay un proceso del ETL en ejecución. ¿Estás seguro de que deseas salir?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isStepLoading, isRunningAll]);

  // Auto-scroll terminal
  useEffect(() => {
    if (autoScrollLogs) {
      if (activeTab === "terminal" && terminalEndRef.current) {
        terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
      } else if (activeTab === "step" && stepTerminalEndRef.current) {
        stepTerminalEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [logs, autoScrollLogs, activeTab]);

  // Add Log helper
  const addLog = (level: "info" | "success" | "warning" | "error", message: string, source = "ETL") => {
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        source,
        level,
        message,
      },
    ]);
  };

  // Reset Wizard State
  const handleResetWizard = () => {
    if (isStepLoading || isRunningAll) {
      alert("Hay un proceso en ejecución. Espera a que finalice antes de reiniciar.");
      return;
    }
    if (!window.confirm("¿Seguro que deseas reiniciar el asistente del ETL? Se borrará el progreso actual no guardado.")) {
      return;
    }
    try {
      localStorage.removeItem(ETL_STORAGE_KEY);
    } catch {}
    setCurrentStep(1);
    setExtractedEventsBySource({});
    setDeduplicatedEventsBySource({});
    setDeduplicatedDetails([]);
    setEnrichedEventsBySource({});
    setAiDuplicatesList([]);
    setPreviewStats(null);
    setPersistedResults(null);
    setStepError(null);
    addLog("info", "Asistente reiniciado. Listo para iniciar una nueva ejecución.", "Asistente");
  };

  // Recover previous step data from server disk cache
  const handleRecoverFromServer = async () => {
    setIsStepLoading(true);
    setStepError(null);
    addLog("info", "Consultando ejecuciones previas guardadas en el disco del servidor...", "Recuperación");

    try {
      const listRes = await fetch("/api/etl/step");
      const listData = await listRes.json();
      if (!listData.success || !listData.steps || Object.keys(listData.steps).length === 0) {
        throw new Error("No hay ejecuciones previas guardadas en el disco del servidor.");
      }
      const steps = listData.steps;
      let targetStep = 1;
      const recoveredMsgs: string[] = [];

      // Extract
      if (steps.extract) {
        const res = await fetch("/api/etl/step?action=extract");
        const d = await res.json();
        if (d.success && d.data) {
          setExtractedEventsBySource(d.data.events_by_source || {});
          targetStep = 2;
          recoveredMsgs.push(`Paso 1 (${d.data.total_extracted || 0} eventos)`);
        }
      }

      // Deduplicate
      if (steps.deduplicate) {
        const res = await fetch("/api/etl/step?action=deduplicate");
        const d = await res.json();
        if (d.success && d.data) {
          setDeduplicatedEventsBySource(d.data.events_by_source || {});
          setDeduplicatedDetails(d.data.deduplicated_details || []);
          targetStep = 3;
          recoveredMsgs.push(`Paso 2 (${d.data.total_unique || 0} únicos)`);
        }
      }

      // Enrich
      if (steps.enrich) {
        const res = await fetch("/api/etl/step?action=enrich");
        const d = await res.json();
        if (d.success && d.data) {
          const rawEventsBySource: Record<string, NormalizedEventItem[]> = d.data.events_by_source || {};
          const processed: Record<string, NormalizedEventItem[]> = {};
          for (const [src, list] of Object.entries(rawEventsBySource)) {
            processed[src] = ((list as any[]) || []).map((ev) => ({
              ...ev,
              _excluded:
                !!(ev.ai_duplicate_match && ev.ai_duplicate_match.is_duplicate) ||
                ev.db_status === "unchanged",
            }));
          }
          setEnrichedEventsBySource(processed);
          setAiDuplicatesList(d.data.ai_duplicates || []);
          targetStep = 4;
          recoveredMsgs.push(`Paso 3 (${d.data.total_valid || 0} enriquecidos)`);
        }
      }

      // Preview
      if (steps.preview) {
        const res = await fetch("/api/etl/step?action=preview");
        const d = await res.json();
        if (d.success && d.data) {
          setPreviewStats(d.data);
          recoveredMsgs.push("Paso 4 (Previsualización)");
        }
      }

      setCurrentStep(targetStep);
      addLog("success", `Datos recuperados del servidor con éxito: ${recoveredMsgs.join(", ")}.`, "Recuperación");
    } catch (err: any) {
      setStepError(err.message);
      addLog("error", `Error al recuperar datos del servidor: ${err.message}`, "Recuperación");
    } finally {
      setIsStepLoading(false);
    }
  };

  // Toggle Source Selection
  const toggleSourceSelection = (sourceId: string) => {
    setSelectedSources((prev) =>
      prev.includes(sourceId) ? prev.filter((s) => s !== sourceId) : [...prev, sourceId]
    );
  };

  // Execute Full Sync (Single Source or All) via Server-Sent Events
  const handleRunFullSync = async (specificSource?: string) => {
    const sourcesToRun = specificSource ? [specificSource] : selectedSources;
    if (sourcesToRun.length === 0) {
      addLog("warning", "Selecciona al menos una fuente para ejecutar.");
      return;
    }

    setIsRunningAll(true);
    if (specificSource) setRunningSourceId(specificSource);
    setActiveTab("terminal");

    addLog(
      "info",
      `Iniciando ejecución para fuentes: [${sourcesToRun.join(", ")}] (Ciudad: ${selectedCity}, Dry-Run: ${isDryRun}, Sin IA: ${skipAi})...`
    );

    try {
      const response = await fetch("/api/etl/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: sourcesToRun,
          city: selectedCity,
          startDate,
          daysAhead,
          dryRun: isDryRun,
          skipAi,
          noInteractive: true,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Error en el servidor: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "log") {
                addLog(event.level || "info", event.message, specificSource || "Pipeline");
              } else if (event.type === "done") {
                addLog(
                  event.success ? "success" : "error",
                  `Proceso finalizado con código de salida: ${event.exitCode}`
                );
              }
            } catch (err) {
              // Ignore unparsed SSE chunk
            }
          }
        }
      }

      refetchReport();
      refetchStatus();
    } catch (err: any) {
      addLog("error", `Fallo en la ejecución: ${err.message}`);
    } finally {
      setIsRunningAll(false);
      setRunningSourceId(null);
    }
  };

  // Helper to execute a step via streaming SSE, dispatching live logs to state
  const executeStepWithStream = async (
    body: {
      action: string;
      sources?: string[];
      city?: string;
      startDate?: string;
      daysAhead?: number;
      skipAi?: boolean;
      dryRun?: boolean;
      eventsBySource?: Record<string, any[]>;
    },
    stepLabel: string
  ): Promise<any> => {
    const res = await fetch("/api/etl/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let errorMsg = `Error en servidor (${res.status})`;
      try {
        const errorJson = await res.json();
        if (errorJson.error) errorMsg = errorJson.error;
      } catch {}
      throw new Error(errorMsg);
    }

    if (!res.body) {
      throw new Error("Respuesta del servidor sin stream de datos");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult: any = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(trimmed.slice(6));
          if (event.type === "log") {
            addLog(event.level || "info", event.message, stepLabel);
          } else if (event.type === "result") {
            finalResult = event.data;
          } else if (event.type === "error") {
            throw new Error(event.error || "Error durante la ejecución del paso");
          }
        } catch (err: any) {
          if (err.message && !err.message.includes("JSON")) {
            throw err;
          }
        }
      }
    }

    if (buffer.trim().startsWith("data: ")) {
      try {
        const event = JSON.parse(buffer.trim().slice(6));
        if (event.type === "result") {
          finalResult = event.data;
        } else if (event.type === "error") {
          throw new Error(event.error || "Error durante la ejecución del paso");
        }
      } catch (err: any) {
        if (err.message && !err.message.includes("JSON")) {
          throw err;
        }
      }
    }

    if (!finalResult) {
      throw new Error(`El paso '${body.action}' finalizó sin devolver datos de resultado.`);
    }

    return finalResult;
  };

  // Step-by-Step Handlers
  const handleExecuteStep1Extract = async () => {
    setIsStepLoading(true);
    setStepError(null);
    addLog("info", `Ejecutando Paso 1: Extracción desde [${selectedSources.join(", ")}]...`, "Paso 1");

    try {
      const resultData = await executeStepWithStream(
        {
          action: "extract",
          sources: selectedSources,
          city: selectedCity,
          startDate,
          daysAhead,
        },
        "Paso 1"
      );

      setExtractedEventsBySource(resultData.events_by_source || {});
      addLog("success", `Paso 1 completado. Total eventos extraídos: ${resultData.total_extracted}`, "Paso 1");
      setCurrentStep(2);
    } catch (err: any) {
      setStepError(err.message);
      addLog("error", `Error en Paso 1: ${err.message}`, "Paso 1");
    } finally {
      setIsStepLoading(false);
    }
  };

  const handleExecuteStep2Deduplicate = async () => {
    setIsStepLoading(true);
    setStepError(null);
    addLog("info", "Ejecutando Paso 2: Deduplicación cruzada y geocodificación preliminar OSM...", "Paso 2");

    try {
      const resultData = await executeStepWithStream(
        {
          action: "deduplicate",
          city: selectedCity,
          eventsBySource: extractedEventsBySource,
        },
        "Paso 2"
      );

      setDeduplicatedEventsBySource(resultData.events_by_source || {});
      setDeduplicatedDetails(resultData.deduplicated_details || []);
      addLog(
        "success",
        `Paso 2 completado. Únicos: ${resultData.total_unique} | Duplicados fusionados/omitidos: ${resultData.total_deduplicated}`,
        "Paso 2"
      );
      setCurrentStep(3);
    } catch (err: any) {
      setStepError(err.message);
      addLog("error", `Error en Paso 2: ${err.message}`, "Paso 2");
    } finally {
      setIsStepLoading(false);
    }
  };

  const handleExecuteStep3Enrich = async (performAi: boolean) => {
    setIsStepLoading(true);
    setStepError(null);
    addLog(
      "info",
      performAi
        ? "Ejecutando Paso 3: Enriquecimiento con Gemini AI y detección de duplicados con contexto de base de datos..."
        : "Paso 3: Conservando datos estructurales nativos (0 llamadas a IA)...",
      "Paso 3"
    );

    try {
      const resultData = await executeStepWithStream(
        {
          action: "enrich",
          city: selectedCity,
          skipAi: !performAi,
          startDate,
          eventsBySource: deduplicatedEventsBySource,
        },
        "Paso 3"
      );

      const rawEventsBySource: Record<string, NormalizedEventItem[]> = resultData.events_by_source || {};
      const processed: Record<string, NormalizedEventItem[]> = {};
      for (const [src, list] of Object.entries(rawEventsBySource)) {
        processed[src] = (list || []).map((ev) => ({
          ...ev,
          _excluded:
            !!(ev.ai_duplicate_match && ev.ai_duplicate_match.is_duplicate) ||
            ev.db_status === "unchanged",
        }));
      }

      setEnrichedEventsBySource(processed);
      setAiDuplicatesList(resultData.ai_duplicates || []);
      addLog(
        "success",
        `Paso 3 completado. Eventos válidos listos para revisión: ${resultData.total_valid} | Duplicados de BD detectados por IA: ${resultData.total_ai_duplicates}`,
        "Paso 3"
      );
      setCurrentStep(4);
    } catch (err: any) {
      setStepError(err.message);
      addLog("error", `Error en Paso 3: ${err.message}`, "Paso 3");
    } finally {
      setIsStepLoading(false);
    }
  };

  const handleExecuteStep4Preview = async () => {
    setIsStepLoading(true);
    setStepError(null);
    addLog("info", "Generando estadísticas preliminares y actualizando etl_report.md...", "Paso 4");

    try {
      const resultData = await executeStepWithStream(
        {
          action: "preview",
          startDate,
          dryRun: isDryRun,
          eventsBySource: enrichedEventsBySource,
        },
        "Paso 4"
      );

      setPreviewStats(resultData);
      addLog("success", `Reporte estructural actualizado en: ${resultData.report_path}`, "Paso 4");
      refetchReport();
    } catch (err: any) {
      setStepError(err.message);
      addLog("error", `Error en Preview: ${err.message}`, "Paso 4");
    } finally {
      setIsStepLoading(false);
    }
  };

  const handleExecuteStep5Persist = async () => {
    setIsStepLoading(true);
    setStepError(null);
    setIsPersistConfirmOpen(false);
    addLog("info", "Iniciando persistencia segura en Supabase (public.events & event_tags)...");

    // Filter out excluded events and events that are already unchanged in DB
    const cleanPayload: Record<string, NormalizedEventItem[]> = {};
    for (const [source, list] of Object.entries(enrichedEventsBySource)) {
      cleanPayload[source] = list.filter((ev) => !ev._excluded && ev.db_status !== "unchanged");
    }

    try {
      const res = await fetch("/api/etl/persist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventsBySource: cleanPayload,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Error al persistir en base de datos");

      setPersistedResults(data.data);
      addLog(
        "success",
        `¡Persistencia exitosa! Insertados: ${data.data.totals.inserted} | Actualizados: ${data.data.totals.updated}`
      );
      setCurrentStep(5);
      queryClient.invalidateQueries({ queryKey: ["admin-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-catalog-stats"] });
      refetchReport();
    } catch (err: any) {
      setStepError(err.message);
      addLog("error", `Error en persistencia: ${err.message}`);
    } finally {
      setIsStepLoading(false);
    }
  };

  // Edit Event in Review Step
  const handleSaveEditedEvent = (updated: NormalizedEventItem) => {
    if (!editingEvent) return;
    const { source, index } = editingEvent;

    setEnrichedEventsBySource((prev) => {
      const sourceList = prev[source] ? [...prev[source]] : [];
      if (sourceList[index]) {
        sourceList[index] = updated;
      }
      return {
        ...prev,
        [source]: sourceList,
      };
    });

    setEditingEvent(null);
    addLog("info", `Evento '${updated.title}' editado por el administrador.`);
  };

  // Toggle Exclude Event from final list
  const toggleExcludeEvent = (source: string, index: number) => {
    setEnrichedEventsBySource((prev) => {
      const sourceList = prev[source] ? [...prev[source]] : [];
      if (sourceList[index]) {
        // Events already unmodified in DB cannot be toggled for insertion
        if (sourceList[index].db_status === "unchanged") return prev;

        sourceList[index] = {
          ...sourceList[index],
          _excluded: !sourceList[index]._excluded,
        };
      }
      return {
        ...prev,
        [source]: sourceList,
      };
    });
  };

  // Select All in Step 4 (only new or updated events)
  const handleSelectAllForPersist = () => {
    setEnrichedEventsBySource((prev) => {
      const next: Record<string, NormalizedEventItem[]> = {};
      for (const [src, list] of Object.entries(prev)) {
        next[src] = (list || []).map((ev) => ({
          ...ev,
          _excluded: ev.db_status === "unchanged" ? true : false,
        }));
      }
      return next;
    });
  };

  // Deselect AI Duplicates in Step 4
  const handleDeselectAiDuplicates = () => {
    setEnrichedEventsBySource((prev) => {
      const next: Record<string, NormalizedEventItem[]> = {};
      for (const [src, list] of Object.entries(prev)) {
        next[src] = (list || []).map((ev) => ({
          ...ev,
          _excluded: !!(ev.ai_duplicate_match && ev.ai_duplicate_match.is_duplicate) ? true : ev._excluded,
        }));
      }
      return next;
    });
  };

  // Deselect All in Step 4
  const handleDeselectAllForPersist = () => {
    setEnrichedEventsBySource((prev) => {
      const next: Record<string, NormalizedEventItem[]> = {};
      for (const [src, list] of Object.entries(prev)) {
        next[src] = (list || []).map((ev) => ({ ...ev, _excluded: true }));
      }
      return next;
    });
  };

  // Bulk Import
  const handleBulkImport = async () => {
    setImportResults(null);
    try {
      const parsed = JSON.parse(bulkDataInput);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      if (items.length === 0) {
        throw new Error("El JSON no contiene ningún elemento");
      }

      const res = await fetch("/api/etl/persist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: items,
        }),
      });

      const resJson = await res.json();
      if (!resJson.success) throw new Error(resJson.error || "Error al insertar JSON");

      setImportResults({ count: items.length });
      setBulkDataInput("");
      addLog("success", `Carga masiva completada: ${items.length} eventos insertados.`);
      queryClient.invalidateQueries({ queryKey: ["admin-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-catalog-stats"] });
    } catch (err: any) {
      setImportResults({ count: 0, error: err.message || "Formato JSON inválido" });
    }
  };

  // Flattened Enriched Events for Review Step
  const allEnrichedEvents = Object.entries(enrichedEventsBySource).flatMap(([src, list]) =>
    list.map((ev, idx) => ({ ...ev, _sourceKey: src, _sourceIdx: idx }))
  );

  const filteredEnrichedEvents = allEnrichedEvents.filter((ev) => {
    const matchesSearch =
      ev.title.toLowerCase().includes(reviewSearch.toLowerCase()) ||
      (ev.address || "").toLowerCase().includes(reviewSearch.toLowerCase()) ||
      (ev.category || "").toLowerCase().includes(reviewSearch.toLowerCase());
    const matchesCat =
      reviewCategoryFilter === "all" ||
      (ev.category || "").toLowerCase() === reviewCategoryFilter.toLowerCase();
    return matchesSearch && matchesCat;
  });

  const totalSelectedToPersist = allEnrichedEvents.filter(
    (ev) => !ev._excluded && ev.db_status !== "unchanged"
  ).length;
  const totalUnchangedInDb = allEnrichedEvents.filter(
    (ev) => ev.db_status === "unchanged"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header & Status Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="font-heading text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
              ETL y Cargas Masivas
            </h1>
            <Badge variant="purple" className="gap-1">
              <Sparkles className="w-3 h-3" /> Ingestion Engine v2
            </Badge>

            {statusData?.data?.isConfigured ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="w-3 h-3" /> Python venv Conectado
              </Badge>
            ) : (
              <Badge variant="warning" className="gap-1">
                <AlertTriangle className="w-3 h-3" /> Verificando Entorno...
              </Badge>
            )}

            {isDryRun ? (
              <Badge variant="warning" className="gap-1">
                <ShieldAlert className="w-3 h-3" /> 🧪 Modo Dry-Run (Protegido)
              </Badge>
            ) : (
              <Badge variant="danger" className="gap-1">
                ⚡ DB Persist Activo
              </Badge>
            )}

            {skipAi ? (
              <Badge variant="default" className="gap-1">
                🪙 Sin IA (0 Cuota)
              </Badge>
            ) : (
              <Badge variant="purple" className="gap-1">
                ✨ Gemini 3.5 Flash Activo
              </Badge>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Control interactivo del pipeline de scraping, deduplicación espacial/temporal, enriquecimiento y sincronización
            con Supabase.
          </p>
        </div>

        {/* Global Toolbar Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetchStatus()}
            isLoading={isLoadingStatus}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Verificar Conexión
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsUploadModalOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            Carga JSON
          </Button>

          <Button
            size="sm"
            onClick={() => handleRunFullSync()}
            isLoading={isRunningAll}
            className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Ejecutar Todo el ETL
          </Button>
        </div>
      </div>

      {/* Configuration & Controls Panel */}
      <Card className="border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-center">
            {/* City selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Ciudad / Región
              </label>
              <select
                value={selectedCity}
                onChange={(e: any) => setSelectedCity(e.target.value)}
                className="w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2 text-zinc-800 dark:text-zinc-200 focus:outline-none"
              >
                <option value="all">Todas las Ciudades (Corrientes + Resistencia)</option>
                <option value="corrientes">Corrientes (Capital)</option>
                <option value="resistencia">Resistencia (Chaco)</option>
              </select>
            </div>

            {/* Start Date */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                A partir de la fecha
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2 text-zinc-800 dark:text-zinc-200 focus:outline-none"
              />
            </div>

            {/* Days Ahead */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Ventana de búsqueda
              </label>
              <select
                value={daysAhead}
                onChange={(e) => setDaysAhead(Number(e.target.value))}
                className="w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2 text-zinc-800 dark:text-zinc-200 focus:outline-none"
              >
                <option value={30}>Próximos 30 días</option>
                <option value={60}>Próximos 60 días</option>
                <option value={90}>Próximos 90 días (Recomendado)</option>
                <option value={180}>Próximos 6 meses</option>
              </select>
            </div>

            {/* Dry Run Toggle */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Modo Prueba (Dry-Run)
              </label>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="toggleDryRun"
                  checked={isDryRun}
                  onChange={(e) => setIsDryRun(e.target.checked)}
                  className="rounded border-zinc-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="toggleDryRun" className="text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                  {isDryRun ? "🛡️ Activado (Sin escribir en BD)" : "⚡ Desactivado (Persistir en BD)"}
                </label>
              </div>
            </div>

            {/* AI Toggle */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Enriquecimiento IA (Gemini)
              </label>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="toggleSkipAi"
                  checked={!skipAi}
                  onChange={(e) => setSkipAi(!e.target.checked)}
                  className="rounded border-zinc-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="toggleSkipAi" className="text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                  {!skipAi ? "✨ Activado (Usa API Gemini)" : "🪙 Desactivado (0 consumo)"}
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sources Grid with One-Click Single Source Triggers */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold tracking-wider uppercase text-zinc-500">
            Fuentes de Eventos Configuradas ({statusData?.data?.availableSources?.length || 5})
          </h2>
          <span className="text-xs text-zinc-400">Selecciona o ejecuta individualmente</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {(statusData?.data?.availableSources || []).map((source) => {
            const isSelected = selectedSources.includes(source.id);
            const isThisRunning = runningSourceId === source.id;
            return (
              <Card
                key={source.id}
                className={`transition-all duration-200 ${
                  isSelected
                    ? "border-purple-300 dark:border-purple-900/60 bg-purple-50/10 dark:bg-purple-950/10"
                    : "border-zinc-200 dark:border-zinc-800 opacity-70"
                }`}
              >
                <CardHeader className="p-3 pb-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                      {source.city}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleSourceSelection(source.id)}
                      className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                        isSelected
                          ? "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                      title="Haz clic para incluir o excluir esta fuente del pipeline interactivo"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded text-purple-600 focus:ring-purple-500 w-3 h-3 cursor-pointer pointer-events-none"
                      />
                      <span>{isSelected ? "Activa" : "Omitida"}</span>
                    </button>
                  </div>
                  <CardTitle className="text-sm font-bold mt-1.5 truncate" title={source.name}>
                    {source.name}
                  </CardTitle>
                  <CardDescription className="text-[11px] line-clamp-2 mt-0.5" title={source.description}>
                    {source.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-7 gap-1"
                    onClick={() => handleRunFullSync(source.id)}
                    isLoading={isThisRunning}
                    disabled={isRunningAll}
                  >
                    <Play className="w-3 h-3" />
                    Scrapear Fuente
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-6">
        <button
          onClick={() => setActiveTab("step")}
          className={`pb-3 text-sm font-medium transition-colors flex items-center gap-2 relative ${
            activeTab === "step"
              ? "text-purple-600 dark:text-purple-400 font-bold border-b-2 border-purple-600 dark:border-purple-400"
              : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <Layers className="w-4 h-4" />
          Pipeline Interactivo Paso a Paso
          {currentStep > 1 && (
            <span className="h-2 w-2 rounded-full bg-purple-500" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("terminal")}
          className={`pb-3 text-sm font-medium transition-colors flex items-center gap-2 relative ${
            activeTab === "terminal"
              ? "text-purple-600 dark:text-purple-400 font-bold border-b-2 border-purple-600 dark:border-purple-400"
              : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <Terminal className="w-4 h-4" />
          Consola en Vivo & Logs
          {(isRunningAll || isStepLoading) && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
        </button>

        <button
          onClick={() => setActiveTab("report")}
          className={`pb-3 text-sm font-medium transition-colors flex items-center gap-2 relative ${
            activeTab === "report"
              ? "text-purple-600 dark:text-purple-400 font-bold border-b-2 border-purple-600 dark:border-purple-400"
              : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <FileCode className="w-4 h-4" />
          Reporte Markdown ({reportData?.data?.exists ? "Generado" : "Sin Reporte"})
        </button>

        <button
          onClick={() => setActiveTab("bulk")}
          className={`pb-3 text-sm font-medium transition-colors flex items-center gap-2 relative ${
            activeTab === "bulk"
              ? "text-purple-600 dark:text-purple-400 font-bold border-b-2 border-purple-600 dark:border-purple-400"
              : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <Upload className="w-4 h-4" />
          Carga Masiva JSON Manual
        </button>
      </div>

      {/* TAB 1: STEP-BY-STEP INTERACTIVE WIZARD */}
      {activeTab === "step" && (
        <div className="space-y-6">
          {/* Wizard Header Bar & Recovery Tools */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-zinc-100/80 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
            <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="font-semibold">Estado del Asistente:</span>
              <span className="text-zinc-500 dark:text-zinc-400">
                {currentStep === 1 && "Paso 1: Extracción de Eventos"}
                {currentStep === 2 && "Paso 2: Deduplicación cruzada"}
                {currentStep === 3 && "Paso 3: Enriquecimiento con IA"}
                {currentStep === 4 && "Paso 4: Revisión manual & Filtros"}
                {currentStep === 5 && "Paso 5: Persistencia en Supabase"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleRecoverFromServer}
                isLoading={isStepLoading}
                className="h-7 text-xs gap-1"
                title="Recupera el último paso ejecutado que fue guardado en disco en el servidor"
              >
                <Download className="w-3.5 h-3.5" />
                Recuperar del Servidor
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleResetWizard}
                disabled={isStepLoading || isRunningAll}
                className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 gap-1"
                title="Reiniciar el asistente al Paso 1 y limpiar la memoria local"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Reiniciar Asistente
              </Button>
            </div>
          </div>

          {/* Step Progress Bar */}
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            {[
              { num: 1, label: "1. Extracción" },
              { num: 2, label: "2. Deduplicación" },
              { num: 3, label: "3. Enriquecimiento" },
              { num: 4, label: "4. Revisión & Edición" },
              { num: 5, label: "5. Persistencia" },
            ].map((st) => (
              <div
                key={st.num}
                onClick={() => setCurrentStep(st.num)}
                className={`p-2.5 rounded-xl border font-bold cursor-pointer transition-all ${
                  currentStep === st.num
                    ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20"
                    : currentStep > st.num
                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                    : "bg-zinc-100 dark:bg-zinc-900 text-zinc-400 border-zinc-200 dark:border-zinc-800"
                }`}
              >
                {st.label}
              </div>
            ))}
          </div>

          {stepError && (
            <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs flex items-center justify-between">
              <span>{stepError}</span>
              <Button size="sm" variant="ghost" onClick={() => setStepError(null)}>
                Descartar
              </Button>
            </div>
          )}

          {/* STEP 1: EXTRACTION */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">Paso 1: Extracción de Eventos Brutos</CardTitle>
                    <CardDescription className="text-xs">
                      Obtiene los eventos crudos desde las fuentes seleccionadas a partir del {startDate} (+{daysAhead} días).
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleExecuteStep1Extract}
                    isLoading={isStepLoading}
                    disabled={selectedSources.length === 0}
                    className="gap-2 bg-purple-600 hover:bg-purple-700 text-white shrink-0"
                  >
                    <Play className="w-4 h-4" />
                    Iniciar Extracción ({selectedSources.length} {selectedSources.length === 1 ? "fuente" : "fuentes"})
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Source Selection Panel inside Step 1 */}
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Fuentes a scrapear en este lote ({selectedSources.length} de {statusData?.data?.availableSources?.length || 5} seleccionadas):
                    </span>
                    <div className="flex items-center gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setSelectedSources(["visitcorrientes", "corrientes-events", "calcuchaco"])}
                        className="px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[11px] font-semibold hover:bg-purple-200 dark:hover:bg-purple-900 transition-colors"
                      >
                        Solo Agendas (Recomendado)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSources((statusData?.data?.availableSources || []).map((s) => s.id))}
                        className="px-2.5 py-1 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium transition-colors"
                      >
                        Todas (5)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSources([])}
                        className="px-2.5 py-1 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium transition-colors"
                      >
                        Deseleccionar Todas
                      </button>
                    </div>
                  </div>

                  {/* Source grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {(statusData?.data?.availableSources || []).map((source) => {
                      const isSelected = selectedSources.includes(source.id);
                      return (
                        <div
                          key={source.id}
                          onClick={() => toggleSourceSelection(source.id)}
                          className={`p-3 rounded-lg border cursor-pointer select-none transition-all flex items-start gap-3 ${
                            isSelected
                              ? "border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 text-zinc-900 dark:text-zinc-100 shadow-sm"
                              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 text-zinc-400 opacity-60 hover:opacity-90"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 mt-0.5 cursor-pointer pointer-events-none"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-bold uppercase px-1 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                                {source.city}
                              </span>
                              <span className="text-xs font-bold truncate">{source.name}</span>
                            </div>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                              {source.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedSources.length === 0 && (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Selecciona al menos una fuente arriba para habilitar el botón de extracción.</span>
                    </div>
                  )}

                  {(selectedSources.includes("google-places") || selectedSources.includes("instagram")) && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      💡 Nota: Las fuentes &apos;Google Places&apos; e &apos;Instagram&apos; son extractores más pesados de recintos y publicaciones, y pueden requerir más tiempo.
                    </p>
                  )}
                </div>

                {Object.keys(extractedEventsBySource).length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {Object.entries(extractedEventsBySource).map(([src, list]) => (
                        <div key={src} className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                          <span className="text-[10px] uppercase font-bold text-zinc-500">{src}</span>
                          <p className="text-xl font-black text-zinc-900 dark:text-zinc-100">{list.length} eventos</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end pt-4 border-t border-zinc-200 dark:border-zinc-800">
                      <Button onClick={() => setCurrentStep(2)} className="gap-2">
                        Avanzar a Paso 2: Deduplicación <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-zinc-400 border border-dashed rounded-xl border-zinc-200 dark:border-zinc-800">
                    <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">
                      {selectedSources.length > 0
                        ? `Listo para extraer desde ${selectedSources.join(", ")}. Haz clic en "Iniciar Extracción" para comenzar.`
                        : "Selecciona una o más fuentes arriba para comenzar."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* STEP 2: DEDUPLICATION & GEOCODING */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Paso 2: Deduplicación y Geocodificación</CardTitle>
                    <CardDescription className="text-xs">
                      Compara eventos contra la base de datos y dentro del lote usando fuzzy matching y geocodificación OSM Nominatim.
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleExecuteStep2Deduplicate}
                    isLoading={isStepLoading}
                    className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Play className="w-4 h-4" />
                    Ejecutar Deduplicación
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.keys(deduplicatedEventsBySource).length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                        <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                          Eventos Únicos
                        </span>
                        <p className="text-xl font-black text-emerald-800 dark:text-emerald-200">
                          {Object.values(deduplicatedEventsBySource).reduce((acc, l) => acc + l.length, 0)}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">
                          Duplicados Fusionados
                        </span>
                        <p className="text-xl font-black text-amber-800 dark:text-amber-200">
                          {deduplicatedDetails.length}
                        </p>
                      </div>
                    </div>

                    {deduplicatedDetails.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                          Detalle de Coincidencias Deduplicadas:
                        </h4>
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2">
                          {deduplicatedDetails.map((dup, i) => (
                            <div
                              key={i}
                              className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs flex items-center justify-between"
                            >
                              <div>
                                <span className="font-bold text-zinc-800 dark:text-zinc-200">{dup.title}</span>
                                <span className="text-zinc-400 ml-2">[{dup.source}]</span>
                              </div>
                              <div className="text-right">
                                <Badge variant="warning" className="text-[10px]">
                                  {dup.reason} ({Math.round(dup.score)}%)
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
                      <Button variant="outline" onClick={() => setCurrentStep(1)}>
                        Volver a Paso 1
                      </Button>
                      <Button onClick={() => setCurrentStep(3)} className="gap-2">
                        Avanzar a Paso 3: Enriquecimiento IA <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-zinc-400 border border-dashed rounded-xl border-zinc-200 dark:border-zinc-800">
                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Haz clic en &quot;Ejecutar Deduplicación&quot; para procesar los eventos extraídos.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* STEP 3: ENRICHMENT WITH GEMINI & DB DUPLICATE CONTEXT */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Paso 3: Enriquecimiento con IA (Gemini)</CardTitle>
                    <CardDescription className="text-xs">
                      Clasifica categorías, tags, horarios, genera copy conciso DateBox y verifica duplicados en la base de datos en una sola llamada.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExecuteStep3Enrich(false)}
                      isLoading={isStepLoading}
                      className="text-xs"
                    >
                      ⏩ Saltear IA (0 Cuota)
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleExecuteStep3Enrich(true)}
                      isLoading={isStepLoading}
                      className="text-xs bg-purple-600 hover:bg-purple-700 text-white gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Enriquecer con Gemini
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.keys(enrichedEventsBySource).length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                        <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400">
                          Eventos Enriquecidos
                        </span>
                        <p className="text-xl font-black text-purple-900 dark:text-purple-100">
                          {Object.values(enrichedEventsBySource).reduce((acc, l) => acc + l.length, 0)}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">
                          Duplicados Detectados en BD
                        </span>
                        <p className="text-xl font-black text-amber-900 dark:text-amber-100">
                          {aiDuplicatesList.length}
                        </p>
                      </div>
                    </div>

                    {aiDuplicatesList.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600">
                          Duplicados en Base de Datos Detectados por IA:
                        </h4>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {aiDuplicatesList.map((dup, i) => (
                            <div
                              key={i}
                              className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs flex justify-between items-center"
                            >
                              <span className="font-semibold text-amber-900 dark:text-amber-200">{dup.title}</span>
                              <Badge variant="warning" className="text-[10px]">
                                {dup.reason || "Coincide con DB"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
                      <Button variant="outline" onClick={() => setCurrentStep(2)}>
                        Volver a Paso 2
                      </Button>
                      <Button onClick={() => setCurrentStep(4)} className="gap-2">
                        Avanzar a Paso 4: Revisión Visual y Edición <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-zinc-400 border border-dashed rounded-xl border-zinc-200 dark:border-zinc-800">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50 text-purple-500" />
                    <p className="text-xs">
                      Elige si deseas enriquecer con Gemini o avanzar directamente sin IA para proteger tu cuota.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* STEP 4: VISUAL REVIEW, INLINE EDIT, MAP & ITEM SELECTION */}
          {currentStep === 4 && (
            <Card>
              <CardHeader className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Paso 4: Inspección Visual y Edición de Eventos</CardTitle>
                    <CardDescription className="text-xs">
                      Revisa en detalle cada evento, edita campos si es necesario, visualiza ubicaciones en mapas y selecciona los que deseas guardar.
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleExecuteStep4Preview}
                      isLoading={isStepLoading}
                      className="text-xs gap-1.5"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      Actualizar Reporte Preview
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => setIsPersistConfirmOpen(true)}
                      disabled={totalSelectedToPersist === 0}
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Persistir {totalSelectedToPersist} Eventos Nuevos en Supabase
                    </Button>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row gap-3 pt-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Buscar por título, dirección o categoría..."
                      value={reviewSearch}
                      onChange={(e) => setReviewSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                    />
                  </div>

                  <select
                    value={reviewCategoryFilter}
                    onChange={(e) => setReviewCategoryFilter(e.target.value)}
                    className="text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                  >
                    <option value="all">Todas las Categorías</option>
                    <option value="Gastronomía">Gastronomía</option>
                    <option value="Vida Nocturna & Bares">Vida Nocturna & Bares</option>
                    <option value="Música & Conciertos">Música & Conciertos</option>
                    <option value="Teatro & Espectáculos">Teatro & Espectáculos</option>
                    <option value="Arte & Cultura">Arte & Cultura</option>
                    <option value="Aire Libre & Naturaleza">Aire Libre & Naturaleza</option>
                  </select>
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-3">
                <div className="flex flex-wrap justify-between items-center text-xs text-zinc-500 gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    Mostrando {filteredEnrichedEvents.length} de {allEnrichedEvents.length} eventos (
                    <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{totalSelectedToPersist}</strong> nuevos seleccionados para inserción
                    {totalUnchangedInDb > 0 && (
                      <span className="text-zinc-500 font-normal"> · {totalUnchangedInDb} ya en BD</span>
                    )})
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllForPersist}
                      className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-semibold transition-colors"
                    >
                      Seleccionar Todos los Nuevos
                    </button>
                    {aiDuplicatesList.length > 0 && (
                      <button
                        type="button"
                        onClick={handleDeselectAiDuplicates}
                        className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 text-[11px] font-semibold transition-colors"
                      >
                        ⚠️ Desmarcar Duplicados de IA
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleDeselectAllForPersist}
                      className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-semibold transition-colors"
                    >
                      Deseleccionar Todos
                    </button>
                  </div>
                </div>

                {/* Event Cards List */}
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                  {filteredEnrichedEvents.map((ev) => (
                    <div
                      key={`${ev._sourceKey}-${ev._sourceIdx}`}
                      className={`p-4 rounded-xl border transition-all ${
                        ev.db_status === "unchanged"
                          ? "bg-zinc-50 dark:bg-zinc-900/20 border-zinc-200 dark:border-zinc-800 opacity-75"
                          : ev._excluded
                          ? "bg-zinc-50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 opacity-60"
                          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-purple-300 dark:hover:border-purple-800"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          {ev.db_status === "unchanged" ? (
                            <div
                              className="mt-1 p-0.5 rounded text-zinc-400 dark:text-zinc-500 cursor-default select-none"
                              title="Ya registrado en Base de Datos (sin cambios, no requiere re-inserción)"
                            >
                              <CheckCircle2 className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                            </div>
                          ) : (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExcludeEvent(ev._sourceKey, ev._sourceIdx);
                              }}
                              className="mt-1 cursor-pointer select-none p-0.5 rounded hover:bg-purple-100 dark:hover:bg-purple-950/50 transition-colors"
                              title={ev._excluded ? "Haz clic para incluir en Supabase" : "Haz clic para excluir de Supabase"}
                            >
                              <input
                                type="checkbox"
                                checked={!ev._excluded}
                                onChange={() => toggleExcludeEvent(ev._sourceKey, ev._sourceIdx)}
                                className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                              />
                            </div>
                          )}

                          {/* Image thumbnail if available */}
                          {ev.image_urls && ev.image_urls.length > 0 && (
                            <img
                              src={ev.image_urls[0]}
                              alt={ev.title}
                              className="w-16 h-16 rounded-lg object-cover border border-zinc-200 dark:border-zinc-800 flex-shrink-0"
                              onError={(e: any) => {
                                e.target.style.display = "none";
                              }}
                            />
                          )}

                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-50 truncate">
                                {ev.title}
                              </h3>
                              {ev.db_status === "unchanged" && (
                                <Badge variant="default" className="text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-zinc-500" /> En BD (Sin cambios)
                                </Badge>
                              )}
                              {ev.db_status === "new" && (
                                <Badge variant="success" className="text-[10px] gap-1">
                                  ✨ Nuevo
                                </Badge>
                              )}
                              {ev.db_status === "updated" && (
                                <Badge variant="warning" className="text-[10px] gap-1">
                                  🔄 Actualización
                                </Badge>
                              )}
                              <Badge variant="purple" className="text-[10px]">
                                {ev.category}
                              </Badge>
                              <Badge variant="default" className="text-[10px] uppercase font-mono">
                                {ev.source}
                              </Badge>
                              {ev.is_commercial ? (
                                <Badge variant="warning" className="text-[10px]">
                                  Comercial
                                </Badge>
                              ) : (
                                <Badge variant="success" className="text-[10px]">
                                  Público / Libre
                                </Badge>
                              )}
                              {ev.ai_duplicate_match?.is_duplicate && (
                                <Badge variant="danger" className="text-[10px]">
                                  ⚠️ AI Duplicate
                                </Badge>
                              )}
                            </div>

                            {/* Dates & Location summary */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                              {ev.starts_at && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                                  {new Date(ev.starts_at).toLocaleDateString("es-AR", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}

                              {ev.address && (
                                <span className="flex items-center gap-1 truncate max-w-md" title={ev.address}>
                                  <MapPin className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                                  {ev.address}
                                </span>
                              )}

                              {ev.latitude && ev.longitude && (
                                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                                  ({ev.latitude.toFixed(4)}, {ev.longitude.toFixed(4)})
                                </span>
                              )}
                            </div>

                            {/* Description preview */}
                            {ev.description && (
                              <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2 mt-1">
                                {ev.description}
                              </p>
                            )}

                            {/* Tags preview */}
                            {ev.tags && ev.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {ev.tags.map((t, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                                  >
                                    #{t.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Event Actions */}
                        <div className="flex flex-col sm:flex-row items-center gap-1.5">
                          {ev.google_maps_url ? (
                            <a
                              href={ev.google_maps_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-purple-600 hover:border-purple-300"
                              title="Ver en Google Maps"
                            >
                              <Map className="w-3.5 h-3.5" />
                            </a>
                          ) : ev.latitude && ev.longitude ? (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${ev.latitude},${ev.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-purple-600 hover:border-purple-300"
                              title="Ver Coordenadas en Google Maps"
                            >
                              <Map className="w-3.5 h-3.5" />
                            </a>
                          ) : null}

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs"
                            onClick={() => setInspectingEvent(ev)}
                            title="Inspeccionar Evento"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Ver
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-xs"
                            onClick={() =>
                              setEditingEvent({
                                source: ev._sourceKey,
                                index: ev._sourceIdx,
                                event: { ...ev },
                              })
                            }
                            title="Editar Evento"
                          >
                            <Edit3 className="w-3.5 h-3.5 mr-1" />
                            Editar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <Button variant="outline" onClick={() => setCurrentStep(3)}>
                    Volver a Paso 3
                  </Button>
                  <Button
                    onClick={() => setIsPersistConfirmOpen(true)}
                    disabled={totalSelectedToPersist === 0}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Guardar {totalSelectedToPersist} Eventos en Supabase <CheckCheck className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 5: PERSISTENCE RESULTS */}
          {currentStep === 5 && persistedResults && (
            <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/20 dark:bg-emerald-950/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-emerald-900 dark:text-emerald-100">
                      ¡Sincronización Completada con Éxito!
                    </CardTitle>
                    <CardDescription className="text-xs text-emerald-700 dark:text-emerald-400">
                      Los eventos aprobados han sido guardados y normalizados en la base de datos de Supabase.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800">
                    <span className="text-[10px] font-bold uppercase text-zinc-500">Insertados</span>
                    <p className="text-2xl font-black text-emerald-600">{persistedResults.totals.inserted}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800">
                    <span className="text-[10px] font-bold uppercase text-zinc-500">Actualizados</span>
                    <p className="text-2xl font-black text-purple-600">{persistedResults.totals.updated}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800">
                    <span className="text-[10px] font-bold uppercase text-zinc-500">Sin Cambios</span>
                    <p className="text-2xl font-black text-zinc-600">{persistedResults.totals.unchanged}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800">
                    <span className="text-[10px] font-bold uppercase text-zinc-500">Fallos</span>
                    <p className="text-2xl font-black text-red-500">{persistedResults.totals.failed}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-emerald-200 dark:border-emerald-800">
                  <Button variant="outline" onClick={() => setCurrentStep(1)}>
                    Nueva Corrida de Extracción
                  </Button>
                  <Button
                    onClick={() => (window.location.href = "/catalog")}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  >
                    Ver en Catálogo de Eventos <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Real-time Execution Console inside Step Wizard */}
          <Card className="bg-zinc-950 text-zinc-50 border-zinc-800 shadow-xl mt-6">
            <CardHeader className="border-b border-zinc-800/80 py-3 px-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-400" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Consola de Ejecución & Logs en Tiempo Real
                  </span>
                  {isStepLoading && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800 animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-ping" />
                      Procesando en vivo...
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setAutoScrollLogs(!autoScrollLogs)}
                    className={`text-[11px] font-mono px-2 py-0.5 rounded transition-colors ${
                      autoScrollLogs ? "bg-purple-900/60 text-purple-300" : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    Auto-Scroll: {autoScrollLogs ? "ON" : "OFF"}
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                    onClick={() => setLogs([])}
                  >
                    Limpiar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="font-mono text-xs space-y-1.5 max-h-[360px] overflow-y-auto pr-2">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2.5 leading-relaxed">
                    <span className="text-zinc-500 select-none flex-shrink-0">[{log.timestamp}]</span>
                    {log.source && (
                      <span className="text-[10px] font-semibold text-purple-400/90 bg-purple-950/60 px-1.5 py-0.2 rounded border border-purple-800/40 flex-shrink-0">
                        [{log.source}]
                      </span>
                    )}
                    <span
                      className={`font-bold uppercase text-[10px] px-1.5 py-0.2 rounded flex-shrink-0 ${
                        log.level === "success"
                          ? "bg-emerald-950 text-emerald-400"
                          : log.level === "error"
                          ? "bg-red-950 text-red-400"
                          : log.level === "warning"
                          ? "bg-amber-950 text-amber-400"
                          : "bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      {log.level}
                    </span>
                    <span className="text-zinc-200 break-words flex-1">{log.message}</span>
                  </div>
                ))}
                <div ref={stepTerminalEndRef} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: LIVE TERMINAL LOGS */}
      {activeTab === "terminal" && (
        <Card className="bg-zinc-950 text-zinc-50 border-zinc-800">
          <CardHeader className="border-b border-zinc-800 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-400" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Consola de Ejecución & Logs del ETL
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAutoScrollLogs(!autoScrollLogs)}
                  className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                    autoScrollLogs ? "bg-purple-900/60 text-purple-300" : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  Auto-Scroll: {autoScrollLogs ? "ON" : "OFF"}
                </button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-400" onClick={() => setLogs([])}>
                  Limpiar
                </Button>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`flex h-2 w-2 rounded-full ${
                      isRunningAll || isStepLoading ? "bg-emerald-500 animate-pulse" : "bg-zinc-500"
                    }`}
                  />
                  <span className="text-[11px] font-mono text-zinc-400">
                    {isRunningAll ? "Ejecutando pipeline..." : isStepLoading ? "Ejecutando paso..." : "Inactivo"}
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="font-mono text-xs space-y-1.5 max-h-[500px] overflow-y-auto pr-2">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2.5 leading-relaxed">
                  <span className="text-zinc-500 select-none flex-shrink-0">[{log.timestamp}]</span>
                  <span
                    className={`font-bold uppercase text-[10px] px-1.5 py-0.2 rounded flex-shrink-0 ${
                      log.level === "success"
                        ? "bg-emerald-950 text-emerald-400"
                        : log.level === "error"
                        ? "bg-red-950 text-red-400"
                        : log.level === "warning"
                        ? "bg-amber-950 text-amber-400"
                        : "bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    {log.level}
                  </span>
                  {log.source && <span className="text-purple-400 flex-shrink-0">[{log.source}]</span>}
                  <span className="text-zinc-200 break-words flex-1">{log.message}</span>
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: FORMATTED MARKDOWN REPORT VIEWER */}
      {activeTab === "report" && (
        <Card>
          <CardHeader className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Reporte de Sincronización (etl_report.md)</CardTitle>
                <CardDescription className="text-xs">
                  {reportData?.data?.mtime
                    ? `Última actualización: ${new Date(reportData.data.mtime).toLocaleString("es-AR")}`
                    : "No se ha generado ningún reporte recientemente."}
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => refetchReport()} isLoading={isLoadingReport}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Recargar Reporte
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {reportData?.data?.content ? (
              <div className="bg-zinc-950 text-zinc-100 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-[600px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {reportData.data.content}
              </div>
            ) : (
              <div className="p-8 text-center text-zinc-400">
                <FileCode className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No hay contenido de reporte disponible. Ejecuta el ETL para generarlo.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 4: BULK JSON IMPORT */}
      {activeTab === "bulk" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Carga Masiva Directa de Eventos (JSON)</CardTitle>
            <CardDescription className="text-xs">
              Pega un arreglo JSON estructurado de eventos para procesarlos directamente con el cargador de DateBox.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                Arreglo JSON de Eventos:
              </label>
              <textarea
                rows={12}
                placeholder={`[
  {
    "title": "Recital Acústico en Costanera",
    "description": "Noche de música en vivo y gastronomía al aire libre.",
    "category": "Música & Conciertos",
    "address": "Costanera General San Martín, Corrientes",
    "latitude": -27.465,
    "longitude": -58.835,
    "is_temporary": true,
    "is_commercial": false,
    "starts_at": "2026-09-15T20:00:00Z"
  }
]`}
                value={bulkDataInput}
                onChange={(e) => setBulkDataInput(e.target.value)}
                className="w-full font-mono text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3 text-zinc-900 dark:text-zinc-100 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button onClick={handleBulkImport} disabled={!bulkDataInput.trim()}>
                <Upload className="w-4 h-4 mr-1" />
                Procesar e Insertar en DB
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODAL: EDIT EVENT INLINE */}
      {editingEvent && (
        <Modal
          isOpen={true}
          onClose={() => setEditingEvent(null)}
          title="Editar Evento Antes de Persistir"
          description={`Modifica los campos del evento de [${editingEvent.source}] antes de guardarlo en Supabase.`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500">Título del Evento:</label>
                <input
                  type="text"
                  value={editingEvent.event.title}
                  onChange={(e) =>
                    setEditingEvent({
                      ...editingEvent,
                      event: { ...editingEvent.event, title: e.target.value },
                    })
                  }
                  className="w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-2 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500">Super-Categoría Canónica:</label>
                <select
                  value={editingEvent.event.category}
                  onChange={(e) =>
                    setEditingEvent({
                      ...editingEvent,
                      event: { ...editingEvent.event, category: e.target.value },
                    })
                  }
                  className="w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-2 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="Gastronomía">Gastronomía</option>
                  <option value="Vida Nocturna & Bares">Vida Nocturna & Bares</option>
                  <option value="Música & Conciertos">Música & Conciertos</option>
                  <option value="Teatro & Espectáculos">Teatro & Espectáculos</option>
                  <option value="Arte & Cultura">Arte & Cultura</option>
                  <option value="Aire Libre & Naturaleza">Aire Libre & Naturaleza</option>
                  <option value="Deportes & Fitness">Deportes & Fitness</option>
                  <option value="Juegos & Entretenimiento">Juegos & Entretenimiento</option>
                  <option value="Cine & Audiovisual">Cine & Audiovisual</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500">Dirección / Recinto:</label>
                <input
                  type="text"
                  value={editingEvent.event.address || ""}
                  onChange={(e) =>
                    setEditingEvent({
                      ...editingEvent,
                      event: { ...editingEvent.event, address: e.target.value },
                    })
                  }
                  className="w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-2 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500">Latitud:</label>
                <input
                  type="number"
                  step="0.00001"
                  value={editingEvent.event.latitude ?? ""}
                  onChange={(e) =>
                    setEditingEvent({
                      ...editingEvent,
                      event: {
                        ...editingEvent.event,
                        latitude: e.target.value ? parseFloat(e.target.value) : null,
                      },
                    })
                  }
                  className="w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-2 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500">Longitud:</label>
                <input
                  type="number"
                  step="0.00001"
                  value={editingEvent.event.longitude ?? ""}
                  onChange={(e) =>
                    setEditingEvent({
                      ...editingEvent,
                      event: {
                        ...editingEvent.event,
                        longitude: e.target.value ? parseFloat(e.target.value) : null,
                      },
                    })
                  }
                  className="w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-2 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500">Fecha y Hora de Inicio:</label>
                <input
                  type="text"
                  placeholder="YYYY-MM-DDTHH:MM:SS"
                  value={editingEvent.event.starts_at || ""}
                  onChange={(e) =>
                    setEditingEvent({
                      ...editingEvent,
                      event: { ...editingEvent.event, starts_at: e.target.value },
                    })
                  }
                  className="w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-2 text-zinc-900 dark:text-zinc-100 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500">Fecha y Hora de Fin:</label>
                <input
                  type="text"
                  placeholder="YYYY-MM-DDTHH:MM:SS"
                  value={editingEvent.event.ends_at || ""}
                  onChange={(e) =>
                    setEditingEvent({
                      ...editingEvent,
                      event: { ...editingEvent.event, ends_at: e.target.value },
                    })
                  }
                  className="w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-2 text-zinc-900 dark:text-zinc-100 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500">Descripción:</label>
              <textarea
                rows={4}
                value={editingEvent.event.description || ""}
                onChange={(e) =>
                  setEditingEvent({
                    ...editingEvent,
                    event: { ...editingEvent.event, description: e.target.value },
                  })
                }
                className="w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-2 text-zinc-900 dark:text-zinc-100 leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <Button variant="ghost" size="sm" onClick={() => setEditingEvent(null)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={() => handleSaveEditedEvent(editingEvent.event)}>
                Guardar Modificaciones
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: INSPECT EVENT DETAILS */}
      {inspectingEvent && (
        <Modal
          isOpen={true}
          onClose={() => setInspectingEvent(null)}
          title={inspectingEvent.title}
          description={`Detalles normalizados de la fuente: [${inspectingEvent.source}] (ID: ${inspectingEvent.external_id})`}
          size="lg"
        >
          <div className="space-y-4 text-xs">
            {inspectingEvent.image_urls && inspectingEvent.image_urls.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {inspectingEvent.image_urls.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt={`Preview ${i}`}
                    className="w-32 h-32 object-cover rounded-lg border border-zinc-200 dark:border-zinc-800 flex-shrink-0"
                  />
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div>
                <span className="font-bold text-zinc-500">Categoría:</span> {inspectingEvent.category}
              </div>
              <div>
                <span className="font-bold text-zinc-500">Tipo:</span>{" "}
                {inspectingEvent.is_commercial ? "Comercial" : "Público"} |{" "}
                {inspectingEvent.is_temporary ? "Evento Temporal" : "Lugar Permanente"}
              </div>
              <div>
                <span className="font-bold text-zinc-500">Inicio:</span> {inspectingEvent.starts_at || "N/A"}
              </div>
              <div>
                <span className="font-bold text-zinc-500">Fin:</span> {inspectingEvent.ends_at || "N/A"}
              </div>
              <div className="col-span-2">
                <span className="font-bold text-zinc-500">Dirección:</span> {inspectingEvent.address || "Sin dirección"} (
                {inspectingEvent.latitude}, {inspectingEvent.longitude})
              </div>
            </div>

            {inspectingEvent.description && (
              <div className="space-y-1">
                <span className="font-bold text-zinc-500 uppercase tracking-wider">Descripción DateBox:</span>
                <p className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {inspectingEvent.description}
                </p>
              </div>
            )}

            {inspectingEvent.horarios && inspectingEvent.horarios.length > 0 && (
              <div className="space-y-1">
                <span className="font-bold text-zinc-500 uppercase tracking-wider">Horarios Estructurados (jsonb):</span>
                <pre className="p-2 rounded-lg bg-zinc-950 text-emerald-400 font-mono text-[11px] overflow-x-auto">
                  {JSON.stringify(inspectingEvent.horarios, null, 2)}
                </pre>
              </div>
            )}

            {/* Interactive Navigable Map */}
            {inspectingEvent.latitude && inspectingEvent.longitude ? (
              <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>Ubicación Geográfica ({inspectingEvent.latitude.toFixed(5)}, {inspectingEvent.longitude.toFixed(5)}):</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${inspectingEvent.latitude},${inspectingEvent.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> Abrir en Google Maps
                    </a>
                  </div>
                </div>

                <div className="w-full h-56 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-inner relative bg-zinc-100 dark:bg-zinc-950">
                  <iframe
                    title="Mapa de Ubicación del Evento"
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    scrolling="no"
                    marginHeight={0}
                    marginWidth={0}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                      inspectingEvent.longitude - 0.005
                    }%2C${inspectingEvent.latitude - 0.003}%2C${
                      inspectingEvent.longitude + 0.005
                    }%2C${inspectingEvent.latitude + 0.003}&layer=mapnik&marker=${
                      inspectingEvent.latitude
                    }%2C${inspectingEvent.longitude}`}
                    className="w-full h-full border-0"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Coordenadas no disponibles para este evento. Puedes hacer clic en &quot;Editar&quot; para agregarlas manualmente.</span>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <Button size="sm" onClick={() => setInspectingEvent(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: CONFIRM PERSISTENCE */}
      <Modal
        isOpen={isPersistConfirmOpen}
        onClose={() => setIsPersistConfirmOpen(false)}
        title="Confirmar Guardado en Supabase"
        description="Estás a punto de insertar los eventos aprobados en la base de datos de producción."
        size="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200 space-y-2">
            <p className="font-bold">Resumen de la operación:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Se insertarán o actualizarán <strong>{totalSelectedToPersist}</strong> eventos nuevos/modificados en la tabla <code>public.events</code>.</li>
              <li>Se normalizarán e insertarán las relaciones en <code>public.event_tags</code>.</li>
              {totalUnchangedInDb > 0 && (
                <li>Los <strong>{totalUnchangedInDb}</strong> eventos ya existentes en BD se conservan intactos sin duplicarse ni re-escribirse.</li>
              )}
              <li>Los eventos excluidos o duplicados de IA serán ignorados.</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <Button variant="ghost" size="sm" onClick={() => setIsPersistConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleExecuteStep5Persist}
              isLoading={isStepLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Confirmar e Insertar en Supabase
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
