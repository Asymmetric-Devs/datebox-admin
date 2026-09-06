import { NextResponse } from "next/server";
import { getEtlStatus } from "@/lib/etlRunner";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = getEtlStatus();
    return NextResponse.json({ success: true, data: status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Error al obtener estado del ETL" },
      { status: 500 }
    );
  }
}
