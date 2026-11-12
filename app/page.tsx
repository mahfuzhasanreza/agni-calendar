import { site } from "@/lib/site";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-24 sm:px-8">
      <p className="text-sm font-medium tracking-wide text-muted uppercase">
        NASA Space Apps Challenge 2026
      </p>
      <h1 className="text-5xl font-semibold tracking-tight">
        {site.name} <span lang="bn">{site.nameBn}</span>
      </h1>
      <p className="text-2xl">{site.tagline}</p>
      <p className="max-w-prose text-lg text-muted">{site.description}</p>
      <p className="text-sm text-muted">
        The interactive calendar is being built during the hackathon (14–15 November 2026). Source
        code:{" "}
        <a className="underline underline-offset-4" href={site.repoUrl}>
          GitHub
        </a>
        .
      </p>
      <footer className="mt-12 border-t border-current/10 pt-4 text-xs text-muted">
        {site.dataCredit}
      </footer>
    </main>
  );
}
