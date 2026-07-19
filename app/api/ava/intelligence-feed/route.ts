import { NextResponse } from "next/server";
import { getAvaDailyContextForCurrentUser } from "@/lib/ava/daily-context-server";

export async function GET() {
  const { intelligenceFeed } = (await getAvaDailyContextForCurrentUser()).context;
  return NextResponse.json({ items: intelligenceFeed });
}
