"use client";

import Link from "next/link";
import type { SetupProgress, SetupProgressItem } from "@/lib/types";
import { Button, Card, Progress, cn } from "@/components/ui";

/** One icon per setup step, keyed by the backend item key. */
function TileIcon({ itemKey }: { itemKey: string }) {
  const paths: Record<string, string> = {
    profile:
      "M4 21V8l8-5 8 5v13h-6v-6h-4v6H4z",
    branding:
      "M12 3a9 9 0 100 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1.1.9-2 2-2h2.5c2.2 0 3.5-1.8 3.5-4 0-4.4-4-7.5-9-7.5zM6.5 12a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3-4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z",
    team:
      "M16 11c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3zm-8 0c1.7 0 3-1.3 3-3S9.7 5 8 5 5 6.3 5 8s1.3 3 3 3zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5c0-2.3-4.7-3.5-7-3.5zm8 0c-.3 0-.6 0-1 .1 1.2.8 2 2 2 3.4V19h6v-2.5c0-2.3-4.7-3.5-7-3.5z",
    donors:
      "M12 21s-7.5-5-10-9C.5 8.5 2.5 5 6 5c2 0 3.5 1 4 2 .5-1 2-2 4-2 3.5 0 5.5 3.5 4 7-2.5 4-10 9-10 9h4z",
    campaign:
      "M3 11l14-6v14L3 13v-2zm16-1h2v4h-2v-4zM7 15l1 5h3l-1-5H7z",
    pledges:
      "M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-9 14l-4-4 1.4-1.4L10 14.2l6.6-6.6L18 9l-8 8z",
    payments:
      "M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4H4V6h16v2zm-9 6H4v-2h7v2z",
    ai:
      "M12 2l1.8 5.5L19 9l-5.2 1.5L12 16l-1.8-5.5L5 9l5.2-1.5L12 2zm7 12l.9 2.6L22.5 18l-2.6.9-.9 2.6-.9-2.6L15.5 18l2.6-.9.9-2.6zM5 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z",
  };
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
        <path d={paths[itemKey] ?? paths.profile} />
      </svg>
    </span>
  );
}

function SetupTile({ item }: { item: SetupProgressItem }) {
  return (
    <Card
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden p-5",
        item.complete && "border-emerald/20 bg-emerald-50/40",
      )}
    >
      {item.complete && (
        <span className="absolute -right-8 top-3.5 w-28 rotate-45 bg-gold py-0.5 text-center text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
          Complete
        </span>
      )}
      <div className="flex items-start gap-3">
        <TileIcon itemKey={item.key} />
        <div className="min-w-0">
          <p className="font-semibold text-emerald">{item.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-black/50">{item.description}</p>
        </div>
      </div>
      {!item.complete && item.ctaRoute && item.ctaLabel && (
        <Link href={item.ctaRoute} className="mt-auto">
          <Button size="sm" className="w-full">{item.ctaLabel}</Button>
        </Link>
      )}
    </Card>
  );
}

/**
 * Enterprise-SaaS style onboarding grid: incomplete steps first with one CTA
 * each, completed steps below with a gold ribbon. Hidden entirely once setup
 * reaches 100% (the dashboard has better things to show by then).
 */
export function SetupTileGrid({ progress }: { progress: SetupProgress }) {
  if (progress.percent >= 100) return null;

  const todo = progress.items.filter((i) => !i.complete);
  const done = progress.items.filter((i) => i.complete);

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-black/80">Finish setting up your organization</h2>
          <p className="mt-0.5 text-xs text-black/40">
            {progress.completedCount} of {progress.totalCount} steps complete
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-black/5 bg-white px-4 py-2 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-black/50">
            Organization setup
          </span>
          <Progress percent={progress.percent} className="h-2 w-32" />
          <span className="text-sm font-bold text-emerald">{progress.percent}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {todo.map((item) => <SetupTile key={item.key} item={item} />)}
      </div>

      {done.length > 0 && (
        <>
          <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-black/40">
            Completed
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {done.map((item) => <SetupTile key={item.key} item={item} />)}
          </div>
        </>
      )}
    </section>
  );
}
