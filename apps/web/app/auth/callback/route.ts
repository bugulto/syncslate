import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "../../../lib/supabase/server";

const defaultRedirectPath = "/dashboard";

function getSafeRedirectUrl(request: NextRequest, next: string | null): URL {
  const fallbackUrl = request.nextUrl.clone();
  fallbackUrl.pathname = defaultRedirectPath;
  fallbackUrl.search = "";
  fallbackUrl.hash = "";

  if (!next?.startsWith("/") || next.startsWith("//")) {
    return fallbackUrl;
  }

  const redirectUrl = new URL(next, request.nextUrl.origin);

  return redirectUrl.origin === request.nextUrl.origin
    ? redirectUrl
    : fallbackUrl;
}

function getErrorRedirectUrl(request: NextRequest): URL {
  const errorUrl = request.nextUrl.clone();
  errorUrl.pathname = "/sign-in";
  errorUrl.search = "";
  errorUrl.hash = "";
  errorUrl.searchParams.set("error", "auth_callback_failed");

  return errorUrl;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next");

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        return NextResponse.redirect(getSafeRedirectUrl(request, next));
      }
    } catch {
      // Authentication failures share the same safe redirect below.
    }
  }

  return NextResponse.redirect(getErrorRedirectUrl(request));
}
