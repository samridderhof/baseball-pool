import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
  const response = NextResponse.redirect(new URL(next, url.origin));

  if (code) {
    const supabase = createServerClient(
      env.supabaseUrl,
      env.supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(
            cookiesToSet: Array<{ name: string; value: string; options: any }>
          ) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          }
        }
      }
    );

    await supabase.auth.exchangeCodeForSession(code);
  }

  return response;
}
