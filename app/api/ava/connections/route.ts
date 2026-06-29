import { NextResponse } from "next/server";
import { getAvaConnections } from "@/lib/ava/connections";

export function GET() {
  return NextResponse.json({ connections: getAvaConnections() });
}
