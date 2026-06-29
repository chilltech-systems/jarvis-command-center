import { NextResponse } from "next/server";
import { getConnectorSnapshots } from "@/lib/ava/connector-snapshot";

export function GET() {
  return NextResponse.json({ connectors: getConnectorSnapshots() });
}
