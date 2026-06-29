import { NextResponse } from "next/server";
import { getProjectSummary } from "@/lib/ava/projects";

export function GET() {
  return NextResponse.json(getProjectSummary());
}
