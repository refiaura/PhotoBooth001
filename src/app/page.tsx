import { RouteLine } from "@/components/route-line";
import { id } from "@/i18n/id";
import { CreateBoothForm } from "./create-booth-form";

function Window({ label, tint }: { label: string; tint: string }) {
  return (
    <div
      className={`flex aspect-[3/4] w-full items-end justify-center rounded-3xl border-[6px] border-surface ${tint} pb-3 shadow-[0_6px_0_0_var(--strawberry)]`}
    >
      <span className="font-display text-lg font-semibold text-ink">{label}</span>
    </div>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-5 pt-10 pb-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-5xl leading-none font-bold tracking-tight">{id.appName}</h1>
        <p className="font-display text-2xl leading-snug font-medium text-ink">{id.tagline}</p>
      </header>

      <figure aria-hidden className="grid grid-cols-2 gap-x-5">
        <RouteLine className="col-span-2 -mb-1" />
        <Window label={id.you} tint="bg-strawberry" />
        <Window label={id.partner} tint="bg-sky" />
      </figure>

      <p className="text-base leading-relaxed text-ink-soft">{id.landing.intro}</p>

      <CreateBoothForm />

      <p className="mt-auto text-sm text-ink-soft">{id.landing.privacy}</p>
    </main>
  );
}
