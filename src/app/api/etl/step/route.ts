import { NextRequest } from "next/server";
import { spawn } from "child_process";
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
      return new Response(JSON.stringify({ success: false, error: "Acción de paso inválida" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const etlDir = getEtlDir();
    const pythonPath = getPythonExecutable();

    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    tempInputPath = path.join(tempDir, `etl_input_${timestamp}.json`);
    tempOutputPath = path.join(tempDir, `etl_output_${timestamp}.json`);

    // Write input payload for python step runner
    fs.writeFileSync(
      tempInputPath,
      JSON.stringify({ events_by_source: eventsBySource }, null, 2),
      "utf-8"
    );

    const args: string[] = [
      "-u", // unbuffered output for real-time streaming
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

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const sendEvent = (payload: any) => {
          try {
            const data = `data: ${JSON.stringify(payload)}\n\n`;
            controller.enqueue(encoder.encode(data));
          } catch {
            // Stream closed
          }
        };

        const parseLineLevel = (line: string): "info" | "success" | "warning" | "error" => {
          const lower = line.toLowerCase();
          if (lower.includes("error") || lower.includes("exception") || lower.includes("failed") || lower.includes("fallo")) return "error";
          if (lower.includes("success") || lower.includes("completado") || lower.includes("exitos") || lower.includes("geocoded") || lower.includes("persisted")) return "success";
          if (lower.includes("warning") || lower.includes("skipped") || lower.includes("unresolved") || lower.includes("deduplicad") || lower.includes("omitid")) return "warning";
          return "info";
        };

        const child = spawn(pythonPath, args, {
          cwd: etlDir,
          env: {
            ...process.env,
            PYTHONUNBUFFERED: "1",
          },
          shell: false,
        });

        // 10s keepalive ping so the connection remains permanently open
        const pingInterval = setInterval(() => {
          sendEvent({ type: "ping", timestamp: Date.now() });
        }, 10000);

        child.stdout.on("data", (chunk: Buffer) => {
          const text = chunk.toString("utf-8");
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          for (const line of lines) {
            // Avoid logging raw JSON dumps if any
            if (line.trim().startsWith("{") || line.trim().startsWith("}")) continue;
            sendEvent({
              type: "log",
              level: parseLineLevel(line),
              message: line,
            });
          }
        });

        child.stderr.on("data", (chunk: Buffer) => {
          const text = chunk.toString("utf-8");
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          for (const line of lines) {
            sendEvent({
              type: "log",
              level: parseLineLevel(line),
              message: line,
            });
          }
        });

        child.on("close", (code) => {
          clearInterval(pingInterval);

          try {
            if (code === 0 && tempOutputPath && fs.existsSync(tempOutputPath)) {
              const outputContent = fs.readFileSync(tempOutputPath, "utf-8");
              const parsedData = JSON.parse(outputContent);

              // Persist a durable copy of this step's output to disk
              try {
                const persistentDataDir = path.join(etlDir, "data");
                if (!fs.existsSync(persistentDataDir)) fs.mkdirSync(persistentDataDir, { recursive: true });
                const persistentFilePath = path.join(persistentDataDir, `last_step_${action}.json`);
                fs.writeFileSync(persistentFilePath, outputContent, "utf-8");
              } catch (persistErr) {
                console.error("Failed to persist step result to disk:", persistErr);
              }

              sendEvent({
                type: "result",
                success: true,
                action,
                data: parsedData,
              });
            } else {
              sendEvent({
                type: "error",
                success: false,
                error: `El paso '${action}' finalizó con código de error ${code}`,
              });
            }
          } catch (err: any) {
            sendEvent({
              type: "error",
              success: false,
              error: `Error leyendo resultados: ${err.message}`,
            });
          } finally {
            // Cleanup temp files
            try {
              if (tempInputPath && fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
              if (tempOutputPath && fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
            } catch {}
            controller.close();
          }
        });

        child.on("error", (err) => {
          clearInterval(pingInterval);
          sendEvent({
            type: "error",
            success: false,
            error: `Error al iniciar proceso Python: ${err.message}`,
          });
          controller.close();
        });
      },
      cancel() {
        try {
          if (tempInputPath && fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
          if (tempOutputPath && fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
        } catch {}
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Error al procesar paso ETL" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const etlDir = getEtlDir();
    const dataDir = path.join(etlDir, "data");

    if (action) {
      const filePath = path.join(dataDir, `last_step_${action}.json`);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        const stat = fs.statSync(filePath);
        return new Response(
          JSON.stringify({
            success: true,
            action,
            data: JSON.parse(content),
            mtime: stat.mtime.toISOString(),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: `No hay datos previos guardados para el paso '${action}'` }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // List available cached steps
    const availableSteps: Record<string, string> = {};
    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir);
      for (const f of files) {
        if (f.startsWith("last_step_") && f.endsWith(".json")) {
          const act = f.replace("last_step_", "").replace(".json", "");
          const stat = fs.statSync(path.join(dataDir, f));
          availableSteps[act] = stat.mtime.toISOString();
        }
      }
    }

    return new Response(JSON.stringify({ success: true, steps: availableSteps }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
