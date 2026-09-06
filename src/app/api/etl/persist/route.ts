import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import { getEtlDir, getPythonExecutable } from "@/lib/etlRunner";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let tempInputPath: string | null = null;
  let tempOutputPath: string | null = null;

  try {
    const body = await req.json();
    const { events = [], eventsBySource = {} } = body;

    // Build structured eventsBySource payload
    const payload: Record<string, any[]> = { ...eventsBySource };
    if (Array.isArray(events) && events.length > 0) {
      for (const ev of events) {
        const src = ev.source || "manual";
        if (!payload[src]) payload[src] = [];
        payload[src].push(ev);
      }
    }

    const etlDir = getEtlDir();
    const pythonPath = getPythonExecutable();

    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    tempInputPath = path.join(tempDir, `etl_persist_input_${timestamp}.json`);
    tempOutputPath = path.join(tempDir, `etl_persist_output_${timestamp}.json`);

    fs.writeFileSync(
      tempInputPath,
      JSON.stringify({ events_by_source: payload }, null, 2),
      "utf-8"
    );

    const cmd = `"${pythonPath}" main.py step --action persist --input-file "${tempInputPath}" --output-file "${tempOutputPath}"`;

    try {
      execSync(cmd, {
        cwd: etlDir,
        encoding: "utf-8",
        timeout: 90000,
        maxBuffer: 25 * 1024 * 1024,
      });
    } catch (execErr: any) {
      const stderr = execErr.stderr ? execErr.stderr.toString() : "";
      const stdout = execErr.stdout ? execErr.stdout.toString() : "";
      return NextResponse.json(
        {
          success: false,
          error: `Error al persistir en base de datos: ${execErr.message}`,
          details: stderr || stdout,
        },
        { status: 500 }
      );
    }

    if (!fs.existsSync(tempOutputPath)) {
      return NextResponse.json(
        { success: false, error: "El cargador de base de datos no devolvió respuesta" },
        { status: 500 }
      );
    }

    const outputContent = fs.readFileSync(tempOutputPath, "utf-8");
    const parsedData = JSON.parse(outputContent);

    return NextResponse.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Error al persistir eventos" },
      { status: 500 }
    );
  } finally {
    try {
      if (tempInputPath && fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      if (tempOutputPath && fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    } catch {
      // Ignore cleanup error
    }
  }
}
