import { NextResponse } from "next/server";
import { probeEsco } from "@/lib/escoApi";
import { probeWorldBank } from "@/lib/worldBankApi";

export async function GET() {
  const [esco, worldBank] = await Promise.all([probeEsco(), probeWorldBank()]);
  return NextResponse.json({
    esco: esco ? "live" : "snapshot",
    worldBank: worldBank ? "live" : "snapshot",
    ilostat: "snapshot",
    freyOsborne: "snapshot",
    checkedAt: new Date().toISOString(),
  });
}
