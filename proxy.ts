import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const isLocalDevPreview = process.env.NODE_ENV === "development"
    && ["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname)
    && !request.nextUrl.pathname.startsWith("/api/jarvis");
  const publicPath = request.nextUrl.pathname.startsWith("/login")
    || request.nextUrl.pathname.startsWith("/auth")
    || request.nextUrl.pathname.startsWith("/unauthorized")
    || isLocalDevPreview;

  if (!user && !publicPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (user && !publicPath) {
    const { data: isAdmin } = await supabase.rpc("is_jarvis_admin");
    if (!isAdmin) return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
