import { NextResponse, type NextRequest } from "next/server";
import {
  CUSTOMER_LOCALE_COOKIE,
  CUSTOMER_LOCALE_REQUEST_HEADER,
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

  const localeParam = requestUrl.searchParams.get("locale");
  const localeSlug =
    localeParam !== null && isValidCustomerLocaleParam(localeParam)
      ? parseCustomerLocale(localeParam)
      : null;
  if (localeSlug) {
    requestHeaders.set(CUSTOMER_LOCALE_REQUEST_HEADER, localeSlug);
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("x-request-id", requestId);

  if (localeSlug) {
    response.cookies.set(CUSTOMER_LOCALE_COOKIE, localeSlug, customerLocaleCookieOptions());
  }

  return response;
}

/**
 * Paths are relative to `basePath` (`/visa-processing`). Next.js prepends that
 * automatically — listing `/visa-processing` here matches `/visa-processing/visa-processing`.
 */
export const config = {
  matcher: [
    "/",
    "/apply",
    "/apply/:path*",
    "/sign-in",
    "/sign-in/:path*",
    "/sign-up",
    "/sign-up/:path*",
    "/speak-with-an-expert",
    "/speak-with-an-expert/:path*",
    "/api/:path*",
    "/portal",
    "/portal/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
