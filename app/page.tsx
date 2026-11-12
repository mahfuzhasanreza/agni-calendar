import { Explorer } from "@/components/Explorer";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <SiteHeader current="explorer" />
      <main className="flex flex-col gap-6">
        <Explorer />
      </main>
      <SiteFooter />
    </div>
  );
}
