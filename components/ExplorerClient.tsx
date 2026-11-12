"use client";

import dynamic from "next/dynamic";

/**
 * The explorer runs in the browser only: it reads its initial state from the URL (shareable
 * links) and fetches all data client-side, so there is nothing useful to server-render.
 */
const Explorer = dynamic(() => import("@/components/Explorer").then((m) => m.Explorer), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
      Loading the explorer…
    </div>
  ),
});

export function ExplorerClient() {
  return <Explorer />;
}
