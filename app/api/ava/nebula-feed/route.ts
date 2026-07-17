import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getAvaNebulaSnapshot } from "@/lib/ava/nebula-feed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: NextRequest, expectedToken: string) {
  const authorization = request.headers.get("authorization") || "";
  const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const supplied = Buffer.from(suppliedToken);
  const expected = Buffer.from(expectedToken);
  return supplied.length === expected.length && supplied.length > 0 && timingSafeEqual(supplied, expected);
}

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};

export async function GET(request: NextRequest) {
  const feedToken = process.env.AVA_NEBULA_FEED_TOKEN;
  if (!feedToken) {
    return NextResponse.json({ error: "Nebula feed is not configured." }, { status: 503, headers: responseHeaders });
  }
  if (!authorized(request, feedToken)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: responseHeaders });
  }

  try {
    return NextResponse.json(await getAvaNebulaSnapshot(), { headers: responseHeaders });
  } catch {
    return NextResponse.json({ error: "Nebula feed is temporarily unavailable." }, { status: 503, headers: responseHeaders });
  }
}
