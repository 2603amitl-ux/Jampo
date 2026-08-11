import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const MANAGER_PATHS = ["/employees", "/presets", "/periods", "/history"];
const PUBLIC_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!user && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (user) {
    const role = (user.app_metadata as { role?: string } | null)?.role;
    const isManager = role === "manager";

    if (pathname === "/login") {
      return NextResponse.redirect(
        new URL(isManager ? "/employees" : "/my-schedule", request.url)
      );
    }

    if (pathname === "/") {
      return NextResponse.redirect(
        new URL(isManager ? "/employees" : "/my-schedule", request.url)
      );
    }

    if (!isManager && MANAGER_PATHS.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/my-schedule", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|offline.html|api).*)",
  ],
};
