import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireJarvisAdmin } from "@/lib/jarvis/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { authorized, user } = await requireJarvisAdmin();
  if (!authorized || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Voice is not configured." }, { status: 503 });

  const sdp = await request.text();
  if (!sdp || sdp.length > 100_000) return NextResponse.json({ error: "A valid SDP offer is required." }, { status: 400 });

  const session = {
    type: "realtime",
    model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2",
    instructions: [
      "You are Ava, Cody's calm personal and business AI operating system.",
      "Speak naturally in first person and keep spoken replies concise.",
      "Never claim an external action happened unless the Jarvis approval system confirms it.",
      "For requests involving messages, tasks, calendar changes, device control, Codex, workflows, money, or production systems, call request_jarvis_action.",
    ].join(" "),
    audio: { output: { voice: process.env.OPENAI_REALTIME_VOICE || "marin" } },
    tools: [{
      type: "function",
      name: "request_jarvis_action",
      description: "Route an action request through Jarvis deterministic permissions and approval handling.",
      parameters: {
        type: "object",
        properties: { request: { type: "string", description: "The user's complete requested action." } },
        required: ["request"],
        additionalProperties: false,
      },
    }],
  };
  const form = new FormData();
  form.set("sdp", sdp);
  form.set("session", JSON.stringify(session));
  const safetyId = createHash("sha256").update(user.id).digest("hex");

  const response = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "OpenAI-Safety-Identifier": safetyId,
    },
    body: form,
  });
  const answer = await response.text();
  if (!response.ok) return NextResponse.json({ error: "Ava could not start a voice session." }, { status: 502 });
  return new Response(answer, { status: 200, headers: { "Content-Type": "application/sdp", "Cache-Control": "no-store" } });
}
