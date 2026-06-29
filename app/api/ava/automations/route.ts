import { NextResponse } from "next/server";
import { automationSnapshot } from "@/lib/mock-data/ava";

export function GET() {
  return NextResponse.json(automationSnapshot);
}
