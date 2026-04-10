import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Baseball Pool",
  description: "Private weekly MLB confidence pool built with Next.js and Supabase."
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const hasSession = Boolean(user);

  return (
    <html lang="en">
      <body>
        <div className="site-shell">
          <header className="topbar">
            <Link href="/" className="brand">
              The Baseball Pool
            </Link>
            <nav className="topnav">
              <Link href="/picks">Picks</Link>
              <Link href="/standings">Standings</Link>
              <Link href={hasSession ? "/dashboard" : "/login"}>
                {hasSession ? "Dashboard" : "Login"}
              </Link>
            </nav>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
