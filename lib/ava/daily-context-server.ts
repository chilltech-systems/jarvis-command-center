import "server-only";
import { getAvaDailyContext, getAvaFallbackDailyContext } from "@/lib/ava/daily-context";
import { requireJarvisAdmin } from "@/lib/jarvis/auth";

export async function getAvaDailyContextForCurrentUser() {
  const { authorized, supabase, user } = await requireJarvisAdmin();
  if (!authorized || !user) return getAvaFallbackDailyContext();
  return getAvaDailyContext({ supabase, ownerId: user.id });
}
