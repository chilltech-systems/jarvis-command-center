import { NextResponse } from "next/server";
import { getAvaIntelligenceFeed } from "@/lib/ava/intelligence";

export async function GET() {
  return NextResponse.json({ items: await getAvaIntelligenceFeed() });
}
