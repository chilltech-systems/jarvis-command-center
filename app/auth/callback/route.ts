import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (providerError) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", providerError);
    return NextResponse.redirect(loginUrl);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", error.message);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", "Google sign-in did not return an authorization code. Please try again.");
  return NextResponse.redirect(loginUrl);
}
