import { createClient } from "@/lib/supabase/server";

export async function requireJarvisAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { authorized: false as const, supabase, user: null };

  const { data: isAdmin } = await supabase.rpc("is_jarvis_admin");
  return { authorized: Boolean(isAdmin), supabase, user };
}
