import { NextResponse } from "next/server";
import { getEtlReportContent } from "@/lib/etlRunner";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const report = getEtlReportContent();
    return NextResponse.json({ success: true, data: report });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Error al leer reporte del ETL" },
      { status: 500 }
    );
  }
}
