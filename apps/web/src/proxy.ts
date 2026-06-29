import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 proxy (formerly `middleware.ts`) — §9.2, §12.3.
 *
 * - Gate `/app` and `/admin` on presence of the access cookie; redirect to
 *   login otherwise (the API remains the real authority — this is the cheap
 *   first gate so unauthenticated users never see the shell).
 * - Stamp `X-Robots-Tag: noindex` on authenticated surfaces.
 * - Propagate the pathname as a header so server components can read it.
 *
 * Cookie presence is the only check done here (the proxy can't verify the JWT
 * signature without the key); the layout's `getSession()` performs the real
 * authorisation and role gate.
 */
// The API sets `__Host-access` over HTTPS (production) and `cbs_access` over plain
// HTTP (local dev), where the browser rejects __Host- cookies. Accept either so
// the gate works in both environments (mirrors the API's auth middleware).
const ACCESS_COOKIES = ["__Host-access", "cbs_access"] as const;

function isProtected(pathname: string): boolean {
  return pathname.startsWith("/app") || pathname.startsWith("/admin");
}

function hasAccessCookie(request: NextRequest): boolean {
  return ACCESS_COOKIES.some((name) => request.cookies.has(name));
}

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  if (isProtected(pathname)) {
    if (!hasAccessCookie(request)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname + search);
      return NextResponse.redirect(loginUrl);
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (isProtected(pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  // Run on everything except static assets and the proxied API.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/v1|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
