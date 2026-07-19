import { NextResponse } from "next/server";
import { getAvaDailyContextForCurrentUser } from "@/lib/ava/daily-context-server";

export async function GET() {
  const executiveContext = (await getAvaDailyContextForCurrentUser()).context;

  return NextResponse.json(executiveContext.dailyBrief);
}
