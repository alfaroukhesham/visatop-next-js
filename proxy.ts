import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const { pathname } = request.nextUrl;

  const incomingRequestId = requestHeaders.get("x-request-id");
  const requestId =
    incomingRequestId && incomingRequestId.trim()
      ? incomingRequestId.trim()
      : crypto.randomUUID();

  requestHeaders.set("x-request-id", requestId);

  if (pathname.startsWith("/portal") || pathname.startsWith("/admin")) {
    requestHeaders.set("x-pathname", pathname);
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/portal",
    "/portal/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
