import { NextResponse } from "next/server";
import { runTargetedMasterResolution } from "@/lib/master-resolution/worker";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await runTargetedMasterResolution({
      dryRun: body.dryRun !== false,
      batchSize: Number(body.batchSize || 10),
      entityType: ["venue", "artist"].includes(body.entityType) ? body.entityType : "all",
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Targeted resolution failed" }, { status: 500 });
  }
}
