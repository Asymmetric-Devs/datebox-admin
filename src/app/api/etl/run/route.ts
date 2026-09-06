import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { getEtlDir, getPythonExecutable } from "@/lib/etlRunner";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sources = [],
      city = "all",
      startDate,
      daysBack,
      daysAhead = 90,
      dryRun = true,
      skipAi = true,
      noInteractive = true,
    } = body;

    const etlDir = getEtlDir();
    const pythonPath = getPythonExecutable();

    const args: string[] = ["main.py", "sync-once"];

    if (Array.isArray(sources) && sources.length > 0) {
      for (const s of sources) {
        args.push("--source", s);
      }
    }

    if (city && city !== "all") {
      args.push("--city", city);
    }

    if (startDate) {
      args.push("--start-date", startDate);
    }

    if (daysBack !== undefined && daysBack !== null) {
      args.push("--days-back", String(daysBack));
    }

    if (daysAhead !== undefined && daysAhead !== null) {
      args.push("--days-ahead", String(daysAhead));
    }

    if (dryRun) {
      args.push("--dry-run");
    }

    if (skipAi) {
      args.push("--skip-ai");
    }

    if (noInteractive) {
      args.push("--no-interactive");
    }

    // Set up Server-Sent Events stream
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

        sendEvent({
          type: "start",
          timestamp: new Date().toLocaleTimeString(),
          command: `${pythonPath} ${args.join(" ")}`,
          cwd: etlDir,
          params: { sources, city, startDate, dryRun, skipAi },
        });

        // Spawn child process with unbuffered Python I/O
        const child = spawn(pythonPath, ["-u", ...args], {
          cwd: etlDir,
          env: {
            ...process.env,
            PYTHONUNBUFFERED: "1",
          },
          shell: false,
        });

        const parseLineLevel = (line: string): "info" | "success" | "warning" | "error" => {
          const lower = line.toLowerCase();
          if (lower.includes("error") || lower.includes("exception") || lower.includes("failed")) return "error";
          if (lower.includes("success") || lower.includes("persisted") || lower.includes("completado")) return "success";
          if (lower.includes("warning") || lower.includes("skipped") || lower.includes("deduplicated")) return "warning";
          return "info";
        };

        child.stdout.on("data", (chunk: Buffer) => {
          const text = chunk.toString("utf-8");
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          for (const line of lines) {
            sendEvent({
              type: "log",
              stream: "stdout",
              level: parseLineLevel(line),
              message: line,
              timestamp: new Date().toLocaleTimeString(),
            });
          }
        });

        child.stderr.on("data", (chunk: Buffer) => {
          const text = chunk.toString("utf-8");
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          for (const line of lines) {
            sendEvent({
              type: "log",
              stream: "stderr",
              level: parseLineLevel(line),
              message: line,
              timestamp: new Date().toLocaleTimeString(),
            });
          }
        });

        child.on("close", (code) => {
          sendEvent({
            type: "done",
            exitCode: code,
            success: code === 0,
            timestamp: new Date().toLocaleTimeString(),
          });
          controller.close();
        });

        child.on("error", (err) => {
          sendEvent({
            type: "error",
            message: `Error al iniciar proceso Python: ${err.message}`,
            timestamp: new Date().toLocaleTimeString(),
          });
          controller.close();
        });
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
      JSON.stringify({ success: false, error: error.message || "Error al ejecutar ETL" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
