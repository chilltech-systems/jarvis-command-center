import { NextResponse } from "next/server";
import { getAvaDailyBrief } from "@/lib/ava/daily-brief";

export async function GET() {
  return NextResponse.json(await getAvaDailyBrief());
}
