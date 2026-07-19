import { NextResponse } from "next/server";
import { getAvaDailyContextForCurrentUser } from "@/lib/ava/daily-context-server";

export async function GET() {
  return NextResponse.json((await getAvaDailyContextForCurrentUser()).context.raw.cognitiveState.awareness.gmail);
}
