import { Explorer } from "@/components/Explorer";
import { site } from "@/lib/site";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          NASA Space Apps Challenge 2026 · MODIS + VIIRS hotspot harmonization
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {site.name} <span lang="bn">{site.nameBn}</span>
        </h1>
        <p className="text-lg text-muted-foreground">{site.tagline}</p>
      </header>

      <main className="flex flex-col gap-6">
        <Explorer />
      </main>

      <footer className="mt-auto border-t pt-4 text-xs text-muted-foreground">
        {site.dataCredit} Built for the NASA Space Apps Challenge 2026 ·{" "}
        <a className="underline underline-offset-4" href={site.repoUrl}>
          Source code
        </a>
      </footer>
    </div>
  );
}
