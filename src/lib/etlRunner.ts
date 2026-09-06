import { spawn, execSync, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

export interface EtlEnvironmentStatus {
  isConfigured: boolean;
  venvPath: string | null;
  pythonVersion: string | null;
  hasEnvFile: boolean;
  etlDir: string;
  availableSources: {
    id: string;
    name: string;
    category: string;
    city: string;
    description: string;
  }[];
  lastReportTime: string | null;
  activeJob: boolean;
}

export interface EtlRunParams {
  sources?: string[];
  city?: "all" | "corrientes" | "resistencia";
  startDate?: string;
  daysBack?: number;
  daysAhead?: number;
  dryRun?: boolean;
  skipAi?: boolean;
  noInteractive?: boolean;
}

export interface EtlStepParams {
  action: "extract" | "deduplicate" | "enrich" | "preview" | "persist";
  sources?: string[];
  city?: "all" | "corrientes" | "resistencia";
  startDate?: string;
  daysAhead?: number;
  skipAi?: boolean;
  dryRun?: boolean;
  eventsBySource?: Record<string, any[]>;
}

// Locate events-etl root directory
export function getEtlDir(): string {
  // If NEXT_PUBLIC_ETL_PATH or ETL_PATH is defined in env, use it
  if (process.env.ETL_DIR && fs.existsSync(process.env.ETL_DIR)) {
    return path.resolve(process.env.ETL_DIR);
  }
  // Default monorepo structure: ../../events-etl relative to apps/admin-datebox
  const relativeEtl = path.resolve(process.cwd(), "../../events-etl");
  if (fs.existsSync(relativeEtl)) {
    return relativeEtl;
  }
  // Try sibling directory if running from different root
  const directEtl = path.resolve(process.cwd(), "events-etl");
  if (fs.existsSync(directEtl)) {
    return directEtl;
  }
  return relativeEtl;
}

// Find Python executable in venv or system
export function getPythonExecutable(): string {
  const etlDir = getEtlDir();
  const isWin = process.platform === "win32";

  // Check venv in events-etl
  const venvWin = path.join(etlDir, "venv", "Scripts", "python.exe");
  const venvPosix = path.join(etlDir, "venv", "bin", "python");

  if (isWin && fs.existsSync(venvWin)) {
    return venvWin;
  }
  if (!isWin && fs.existsSync(venvPosix)) {
    return venvPosix;
  }

  // Fallback to python in PATH
  return isWin ? "python.exe" : "python3";
}

export function getEtlStatus(): EtlEnvironmentStatus {
  const etlDir = getEtlDir();
  const pythonPath = getPythonExecutable();
  const hasEnvFile = fs.existsSync(path.join(etlDir, ".env"));
  const reportPath = path.join(etlDir, "etl_report.md");

  let pythonVersion: string | null = null;
  try {
    const versionOutput = execSync(`"${pythonPath}" --version`, {
      cwd: etlDir,
      encoding: "utf-8",
      timeout: 3000,
    });
    pythonVersion = versionOutput.trim();
  } catch (err: any) {
    pythonVersion = null;
  }

  let lastReportTime: string | null = null;
  if (fs.existsSync(reportPath)) {
    try {
      const stats = fs.statSync(reportPath);
      lastReportTime = stats.mtime.toISOString();
    } catch {
      lastReportTime = null;
    }
  }

  return {
    isConfigured: !!pythonVersion && hasEnvFile,
    venvPath: pythonPath,
    pythonVersion,
    hasEnvFile,
    etlDir,
    availableSources: [
      {
        id: "visitcorrientes",
        name: "Visit Corrientes",
        category: "Turismo & Cultura",
        city: "corrientes",
        description: "Agenda oficial de eventos de la Municipalidad de Corrientes (WordPress / The Events Calendar).",
      },
      {
        id: "corrientes-events",
        name: "Corrientes Tur",
        category: "Agenda Provincial",
        city: "corrientes",
        description: "Eventos, festivales y fiestas tradicionales de Corrientes.",
      },
      {
        id: "calcuchaco",
        name: "Calcu Chaco",
        category: "Cultura & Espectáculos",
        city: "resistencia",
        description: "Cartelera cultural, teatro y música en vivo de Resistencia y Chaco.",
      },
      {
        id: "instagram",
        name: "Instagram Events Scraper",
        category: "Social & Boliches",
        city: "all",
        description: "Scraping multimodal de afiches y publicaciones oficiales de cuentas destacadas.",
      },
      {
        id: "google-places",
        name: "Google Places Discovery",
        category: "Puntos de Interés & Sedes",
        city: "all",
        description: "Descubrimiento de espacios públicos, teatros, bares y parques vía Google Maps API.",
      },
    ],
    lastReportTime,
    activeJob: false,
  };
}

export function getEtlReportContent(): { content: string; mtime: string | null; exists: boolean } {
  const etlDir = getEtlDir();
  const reportPath = path.join(etlDir, "etl_report.md");
  if (!fs.existsSync(reportPath)) {
    return { content: "", mtime: null, exists: false };
  }
  try {
    const content = fs.readFileSync(reportPath, "utf-8");
    const stats = fs.statSync(reportPath);
    return { content, mtime: stats.mtime.toISOString(), exists: true };
  } catch (err: any) {
    return { content: `Error leyendo reporte: ${err.message}`, mtime: null, exists: false };
  }
}
