import { NextResponse, type NextRequest } from "next/server";
import {
  CUSTOMER_LOCALE_COOKIE,
  customerLocaleCookieOptions,
  isValidCustomerLocaleParam,
  parseCustomerLocale,
} from "@/lib/i18n/customer-locale";

export function proxy(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const { pathname, search } = requestUrl;

  if (pathname.length > 1 && pathname.endsWith("/")) {
    const destination = new URL(request.url);
    destination.pathname = pathname.slice(0, -1);
    destination.search = search;
    return NextResponse.redirect(destination, 308);
  }

  const requestHeaders = new Headers(request.headers);
  const appPathname = request.nextUrl.pathname;

  const incomingRequestId = requestHeaders.get("x-request-id");
  const requestId =
    incomingRequestId && incomingRequestId.trim()
      ? incomingRequestId.trim()
      : crypto.randomUUID();

  requestHeaders.set("x-request-id", requestId);

  if (appPathname.startsWith("/portal") || appPathname.startsWith("/admin")) {
    requestHeaders.set("x-pathname", appPathname);
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("x-request-id", requestId);

  const localeParam = requestUrl.searchParams.get("locale");
  if (localeParam !== null && isValidCustomerLocaleParam(localeParam)) {
    const slug = parseCustomerLocale(localeParam);
    response.cookies.set(CUSTOMER_LOCALE_COOKIE, slug, customerLocaleCookieOptions());
  }

  return response;
}

export const config = {
  matcher: [
    "/visa-processing",
    "/visa-processing/:path*",
    "/visa-processing/:path*/",
    "/api/:path*",
    "/portal",
    "/portal/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
