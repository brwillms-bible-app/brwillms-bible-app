import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { EsvNotice } from "@/components/EsvNotice";
import { getActiveProvider } from "@/lib/scripture/registry";

// Provider (bsb | esv) is chosen by server env at request time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Picture Bible Adventures",
  description: "A free, non-commercial illustrated audio-visual Bible explorer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const provider = getActiveProvider();
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="logo">
            📜 Picture Bible Adventures
          </Link>
          <nav>
            <Link href="/">Scenes</Link>
            <Link href="/copyright">Copyright</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="footer">
          {provider.id === "esv" ? (
            <>
              {/* ESV active: notice on every page so it is visible wherever ESV text or audio can appear. */}
              <EsvNotice />
              <p className="fineprint">
                Scripture is fetched live from the ESV API for each scene and is never stored.
              </p>
            </>
          ) : (
            <p className="fineprint provider-badge">
              Scripture source: {provider.name}. {provider.attribution}
            </p>
          )}
          <p className="fineprint">
            Free forever: no ads, no subscriptions, no paywalls, no donation requests.{" "}
            <Link href="/copyright">Copyright details</Link>.
          </p>
        </footer>
      </body>
    </html>
  );
}
