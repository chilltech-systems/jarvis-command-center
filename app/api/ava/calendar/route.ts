import { NextResponse } from "next/server";
import { calendarEvents, freeBlocks, upcomingEvents } from "@/lib/mock-data/ava";
import { getAvaDailyContextForCurrentUser } from "@/lib/ava/daily-context-server";

export async function GET() {
  const schedule = (await getAvaDailyContextForCurrentUser()).context.raw.cognitiveState.awareness.calendar as Record<string, unknown>;
  return NextResponse.json({ ...schedule, mock: { today: calendarEvents, upcoming: upcomingEvents, freeBlocks } });
}
