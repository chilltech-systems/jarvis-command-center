import { NextResponse } from "next/server";
import { getAvaDailyContextForCurrentUser } from "@/lib/ava/daily-context-server";

export async function GET() {
  const data = (await getAvaDailyContextForCurrentUser()).context.raw.cognitiveState.awareness.tasks;
  return NextResponse.json(data);
}
