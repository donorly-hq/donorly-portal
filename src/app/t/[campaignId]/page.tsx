"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { api } from "@/lib/api";
import { BRAND } from "@/lib/color";
import type { PublicThermometer } from "@/lib/types";

const POLL_MS = 6000;

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/**
 * Public, projector-friendly thermometer. No login required — the campaign
 * UUID in the URL is the only key, and donor names are abbreviated.
 */
export default function PublicThermometerPage() {
  const params = useParams<{ campaignId: string }>();
  const [data, setData] = useState<PublicThermometer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Pledges already on screen — anything newer gets a brief gold flash.
  const seenRef = useRef<Set<string>>(new Set());
  const [flashing, setFlashing] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    api
      .get<PublicThermometer>(`/public/thermometer/${params.campaignId}`, false)
      .then((d) => {
        const keys = d.recentPledges.map((p) => `${p.donorName}-${p.createdAt}`);
        const seen = seenRef.current;
        const fresh = seen.size > 0 ? keys.filter((k) => !seen.has(k)) : [];
        keys.forEach((k) => seen.add(k));
        if (fresh.length > 0) {
          setFlashing(new Set(fresh));
          setTimeout(() => setFlashing(new Set()), 4000);
        }
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [params.campaignId]);

  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/p/${params.campaignId}`, {
      width: 320,
      margin: 1,
      color: { dark: BRAND.emeraldDark, light: BRAND.white },
    })
      .then(setQr)
      .catch(() => setQr(null));
  }, [params.campaignId]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void containerRef.current?.requestFullscreen();
    }
  };

  const progress =
    data && data.goalAmount > 0 ? Math.min(100, (data.pledged / data.goalAmount) * 100) : 0;
  const goalReached = data ? data.goalAmount > 0 && data.pledged >= data.goalAmount : false;

  return (
    <div
      ref={containerRef}
      className="flex min-h-screen flex-col items-center justify-center bg-emerald-dark px-8 py-10 text-white"
    >
      {!data ? (
        <p className="text-xl text-white/70">{error ?? "Loading…"}</p>
      ) : (
        <div className="flex w-full max-w-5xl flex-col items-center text-center">
          <p className="text-lg uppercase tracking-[0.3em] text-white/50">
            {data.organizationName}
          </p>
          <h1 className="mt-2 font-serif text-4xl font-bold sm:text-6xl">{data.campaignName}</h1>

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
                (goalReached ? "bg-gold-light" : "bg-white")
              }
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className={"mt-3 text-3xl font-bold" + (goalReached ? " text-gold-light" : "")}>
            {goalReached ? "Goal reached — thank you!" : `${Math.round(progress)}% of goal`}
          </p>

          <div className="mt-10 grid w-full grid-cols-2 gap-6 text-center">
            <div>
              <p className="text-4xl font-bold tabular-nums text-gold-light">{money.format(data.collected)}</p>
              <p className="text-sm uppercase tracking-wide text-white/50">collected</p>
            </div>
            <div>
              <p className="text-4xl font-bold tabular-nums">{data.pledgeCount}</p>
              <p className="text-sm uppercase tracking-wide text-white/50">pledges</p>
            </div>
          </div>

          {data.recentPledges.length > 0 ? (
            <div className="mt-10 w-full max-w-2xl">
              <p className="mb-2 text-sm uppercase tracking-wide text-white/40">
                Latest pledges
              </p>
              <div className="space-y-1">
                {data.recentPledges.slice(0, 5).map((p, i) => {
                  const isNew = flashing.has(`${p.donorName}-${p.createdAt}`);
                  return (
                    <div
                      key={`${p.donorName}-${p.createdAt}-${i}`}
                      className={
                        "flex items-center justify-between rounded-lg px-4 py-2 text-lg transition-colors duration-1000 " +
                        (isNew ? "animate-pulse bg-gold-light/40" : "bg-white/10")
                      }
                    >
                      <span className="font-medium">{p.donorName}</span>
                      <span className={"font-bold tabular-nums" + (isNew ? " text-gold-light" : "")}>
                        {money.format(p.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <button
        onClick={toggleFullscreen}
        className="absolute right-4 top-4 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/70 hover:bg-white/20"
      >
        Fullscreen
      </button>

      {qr ? (
        <div className="absolute bottom-6 right-6 hidden flex-col items-center rounded-2xl bg-white p-3 shadow-lg sm:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Scan to pledge" className="h-36 w-36" />
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald">
            Scan to pledge
          </p>
        </div>
      ) : null}
    </div>
  );
}
