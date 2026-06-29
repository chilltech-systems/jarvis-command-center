import { NextResponse } from "next/server";
import { calendarEvents, freeBlocks, upcomingEvents } from "@/lib/mock-data/ava";
import { getAvaSchedule } from "@/lib/ava/todoist";

export async function GET() {
  const schedule = await getAvaSchedule();
  return NextResponse.json({ ...schedule, mock: { today: calendarEvents, upcoming: upcomingEvents, freeBlocks } });
}
