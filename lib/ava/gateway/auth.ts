import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { AvaGatewayIdentity } from "@/lib/ava/gateway/types";

const MAX_CLOCK_SKEW_MS = 60_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 120;
const nonceCache = new Map<string, number>();
const rateLimitCache = new Map<string, { count: number; resetAt: number }>();

function header(request: Request, name: string) {
  return request.headers.get(name)?.trim() || "";
}

function safeEqual(first: string, second: string) {
  const left = Buffer.from(first);
  const right = Buffer.from(second);
  return left.length === right.length && timingSafeEqual(left, right);
}

function cleanNonceCache(now: number) {
  for (const [nonce, expiresAt] of nonceCache) {
    if (expiresAt <= now) nonceCache.delete(nonce);
  }
}

function exceedsRateLimit(key: string, now: number) {
  const current = rateLimitCache.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitCache.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT_MAX_REQUESTS;
}

export function gatewayEnabled() {
  return process.env.AVA_NEBULA_GATEWAY_ENABLED === "true";
}

export async function requireAvaGateway(request: Request): Promise<{
  authorized: true;
  identity: AvaGatewayIdentity;
  bodyText: string;
} | {
  authorized: false;
  status: number;
  error: string;
}> {
  if (!gatewayEnabled()) return { authorized: false, status: 503, error: "Ava Nebula gateway is disabled." };

  const secret = process.env.AVA_NEBULA_GATEWAY_SECRET || "";
  const ownerId = process.env.AVA_OWNER_ID || "";
  const allowedEmail = (process.env.AVA_OWNER_EMAIL || "").toLowerCase();
  if (!secret || !ownerId || !allowedEmail) {
    return { authorized: false, status: 503, error: "Ava Nebula gateway is not configured." };
  }

  const timestamp = header(request, "x-ava-timestamp");
  const nonce = header(request, "x-ava-nonce");
  const email = header(request, "x-ava-user-email").toLowerCase();
  const signature = header(request, "x-ava-signature");
  const bodyText = await request.text();
  const timestampMs = Number(timestamp);
  const now = Date.now();

  if (!timestamp || !nonce || !signature || !email || !Number.isFinite(timestampMs)) {
    return { authorized: false, status: 401, error: "Missing gateway authentication." };
  }
  if (email !== allowedEmail) return { authorized: false, status: 403, error: "Gateway user is not allowed." };
  if (exceedsRateLimit(`${email}:${new URL(request.url).pathname}`, now)) {
    return { authorized: false, status: 429, error: "Ava gateway rate limit exceeded." };
  }
  if (Math.abs(now - timestampMs) > MAX_CLOCK_SKEW_MS) {
    return { authorized: false, status: 401, error: "Gateway request expired." };
  }
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(nonce)) {
    return { authorized: false, status: 401, error: "Invalid gateway nonce." };
  }

  const url = new URL(request.url);
  const payload = [timestamp, nonce, email, request.method.toUpperCase(), url.pathname, bodyText].join("\n");
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (!safeEqual(signature, expected)) return { authorized: false, status: 401, error: "Invalid gateway signature." };

  cleanNonceCache(now);
  if (nonceCache.has(nonce)) return { authorized: false, status: 409, error: "Gateway request was already used." };
  nonceCache.set(nonce, now + MAX_CLOCK_SKEW_MS);

  return { authorized: true, identity: { ownerId, email }, bodyText };
}

export function parseGatewayJson(bodyText: string) {
  try {
    const parsed = JSON.parse(bodyText || "{}") as unknown;
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return null;
  }
}
