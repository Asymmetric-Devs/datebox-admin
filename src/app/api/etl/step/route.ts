import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import { getEtlDir, getPythonExecutable } from "@/lib/etlRunner";

export const dynamic = "force-dynamic";
export const maxDuration = 1200; // 20 minutes max for AI enrichment batches

export async function POST(req: NextRequest) {
  let tempInputPath: string | null = null;
  let tempOutputPath: string | null = null;

  try {
    const body = await req.json();
    const {
      action,
      sources = [],
      city = "all",
      startDate,
      daysAhead = 90,
      skipAi = true,
      dryRun = true,
      eventsBySource = {},
    } = body;

    if (!action || !["extract", "deduplicate", "enrich", "preview", "persist"].includes(action)) {
      return NextResponse.json({ success: false, error: "Acción de paso inválida" }, { status: 400 });
    }

    const etlDir = getEtlDir();
    const pythonPath = getPythonExecutable();

    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    tempInputPath = path.join(tempDir, `etl_input_${timestamp}.json`);
    tempOutputPath = path.join(tempDir, `etl_output_${timestamp}.json`);

    // Write input payload if provided
    fs.writeFileSync(
      tempInputPath,
      JSON.stringify({ events_by_source: eventsBySource }, null, 2),
      "utf-8"
    );

    const args: string[] = [
      "main.py",
      "step",
      "--action",
      action,
      "--city",
      city,
      "--days-ahead",
      String(daysAhead),
      "--input-file",
      tempInputPath,
      "--output-file",
      tempOutputPath,
    ];

    if (Array.isArray(sources) && sources.length > 0) {
      for (const s of sources) {
        args.push("--source", s);
      }
    }

    if (startDate) {
      args.push("--start-date", startDate);
    }

    if (skipAi) {
      args.push("--skip-ai");
    }

    if (dryRun) {
      args.push("--dry-run");
    }

    const cmd = `"${pythonPath}" ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`;

    try {
      execSync(cmd, {
        cwd: etlDir,
        encoding: "utf-8",
        timeout: 1200000, // 20 minutes (matches maxDuration = 1200)
        maxBuffer: 50 * 1024 * 1024,
      });
    } catch (execErr: any) {
      const stderr = execErr.stderr ? execErr.stderr.toString() : "";
      const stdout = execErr.stdout ? execErr.stdout.toString() : "";
      return NextResponse.json(
        {
          success: false,
          error: `Error al ejecutar paso '${action}': ${execErr.message}`,
          details: stderr || stdout,
        },
        { status: 500 }
      );
    }

    if (!fs.existsSync(tempOutputPath)) {
      return NextResponse.json(
        { success: false, error: "El paso no generó archivo de resultados" },
        { status: 500 }
      );
    }

    const outputContent = fs.readFileSync(tempOutputPath, "utf-8");
    const parsedData = JSON.parse(outputContent);

    return NextResponse.json({
      success: true,
      action,
      data: parsedData,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Error al procesar paso ETL" },
      { status: 500 }
    );
  } finally {
    // Cleanup temporary files
    try {
      if (tempInputPath && fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      if (tempOutputPath && fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    } catch {
      // Ignore cleanup error
    }
  }
}
