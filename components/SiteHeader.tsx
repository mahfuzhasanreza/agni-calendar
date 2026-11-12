import Link from "next/link";
import { site } from "@/lib/site";

/** Title + navigation shared by every page. */
export function SiteHeader({ current }: { current: "explorer" | "method" }) {
  const link = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-2.5 py-1.5 text-sm ${active ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground"}`}
    >
      {label}
    </Link>
  );
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          NASA Space Apps Challenge 2026 · MODIS + VIIRS hotspot harmonization
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          <Link href="/">
            {site.name} <span lang="bn">{site.nameBn}</span>
          </Link>
        </h1>
        <p className="text-lg text-muted-foreground">{site.tagline}</p>
      </div>
      <nav aria-label="Main" className="flex gap-1">
        {link("/", "Explorer", current === "explorer")}
        {link("/method", "Method", current === "method")}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t pt-4 text-xs text-muted-foreground">
      {site.dataCredit} Built for the NASA Space Apps Challenge 2026 ·{" "}
      <a className="underline underline-offset-4" href={site.repoUrl}>
        Source code
      </a>{" "}
      · Built with Claude Code (AI-assisted development, see the project page).
    </footer>
  );
}
