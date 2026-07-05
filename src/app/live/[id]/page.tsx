"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { CampaignLive } from "@/lib/types";

const POLL_MS = 6000;

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** Full-screen, projector-friendly campaign tally. Polls every few seconds. */
export default function LiveCampaignPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session, loading } = useAuth();
  const [data, setData] = useState<CampaignLive | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  const load = useCallback(() => {
    api
      .get<CampaignLive>(`/campaigns/${params.id}/live`)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message));
  }, [params.id]);

  useEffect(() => {
    if (!session) return;
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [session, load]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void containerRef.current?.requestFullscreen();
    }
  };

  const bg = session?.organizationPrimaryColor || "#083a2e";

  if (loading || !session) return null;

  return (
    <div
      ref={containerRef}
      className="flex min-h-screen flex-col items-center justify-center px-8 py-10 text-white"
      style={{ backgroundColor: bg }}
    >
      {!data ? (
        error ? (
          <p className="text-xl text-white/70">{error}</p>
        ) : (
          <p className="text-xl text-white/70">Loading…</p>
        )
      ) : (
        <LiveBoard data={data} orgName={session.organizationName ?? ""} />
      )}

      <div className="absolute right-4 top-4 flex gap-2">
        <button
          onClick={toggleFullscreen}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/70 hover:bg-white/20"
        >
          Fullscreen
        </button>
        <button
          onClick={() => router.push(`/campaigns/${params.id}`)}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/70 hover:bg-white/20"
        >
          Exit
        </button>
      </div>
    </div>
  );
}

function LiveBoard({ data, orgName }: { data: CampaignLive; orgName: string }) {
  const progress =
    data.goalAmount > 0 ? Math.min(100, (data.pledged / data.goalAmount) * 100) : 0;
  const goalReached = data.goalAmount > 0 && data.pledged >= data.goalAmount;

  return (
    <div className="flex w-full max-w-5xl flex-col items-center text-center">
      <p className="text-lg uppercase tracking-[0.3em] text-white/50">{orgName}</p>
      <h1 className="mt-2 font-serif text-4xl font-bold sm:text-6xl">{data.name}</h1>

      <p className="mt-10 text-7xl font-black tabular-nums sm:text-9xl">
        {money.format(data.pledged)}
      </p>
      <p className="mt-3 text-2xl text-white/60">
        pledged of a {money.format(data.goalAmount)} goal
      </p>

      <div className="mt-8 h-8 w-full overflow-hidden rounded-full bg-white/15">
        <div
          className={
            "h-full rounded-full transition-all duration-1000 " +
            (goalReached ? "bg-amber-400" : "bg-white")
          }
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-3 text-3xl font-bold">
        {goalReached ? "Goal reached — thank you!" : `${Math.round(progress)}% of goal`}
      </p>

      <div className="mt-10 grid w-full grid-cols-2 gap-6 text-center sm:grid-cols-3">
        <div>
          <p className="text-4xl font-bold tabular-nums">{money.format(data.collected)}</p>
          <p className="text-sm uppercase tracking-wide text-white/50">collected</p>
        </div>
        <div>
          <p className="text-4xl font-bold tabular-nums">{data.pledgeCount}</p>
          <p className="text-sm uppercase tracking-wide text-white/50">pledges</p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <p className="text-4xl font-bold tabular-nums">
            {data.pledgeCount > 0 ? money.format(data.pledged / data.pledgeCount) : "—"}
          </p>
          <p className="text-sm uppercase tracking-wide text-white/50">average pledge</p>
        </div>
      </div>

      {data.recentPledges.length > 0 ? (
        <div className="mt-10 w-full max-w-2xl">
          <p className="mb-2 text-sm uppercase tracking-wide text-white/40">Latest pledges</p>
          <div className="space-y-1">
            {data.recentPledges.slice(0, 5).map((p, i) => (
              <div
                key={`${p.donorName}-${p.createdAt}-${i}`}
                className="flex items-center justify-between rounded-lg bg-white/10 px-4 py-2 text-lg"
              >
                <span className="font-medium">{p.donorName}</span>
                <span className="font-bold tabular-nums">{money.format(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
