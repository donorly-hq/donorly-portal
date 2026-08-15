"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PlatformOrgOverview } from "@/lib/types";
import { Badge, Card, Spinner, cn, currency } from "@/components/ui";

const STATUS_TONE: Record<string, "success" | "info" | "danger" | "neutral"> = {
  active: "success",
  trial: "info",
  suspended: "danger",
};

/** Compact ring showing setup percent, colored by how far along the org is. */
function SetupRing({ percent }: { percent: number }) {
  const r = 16;
  const circumference = 2 * Math.PI * r;
  const color = percent >= 100 ? "text-gold" : percent >= 50 ? "text-emerald" : "text-amber-500";
  return (
    <span className="relative inline-flex h-11 w-11 items-center justify-center">
      <svg viewBox="0 0 40 40" className="h-11 w-11 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="4" className="stroke-black/5" />
        <circle
          cx="20" cy="20" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
          className={cn("stroke-current transition-all duration-700", color)}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-black/70">{percent}%</span>
    </span>
  );
}

function OrgTile({ org }: { org: PlatformOrgOverview }) {
  const thermometerPct = org.goalTotal > 0 ? Math.min(100, (org.collectedTotal / org.goalTotal) * 100) : 0;
  const pledgedPct = org.goalTotal > 0 ? Math.min(100, (org.pledgedTotal / org.goalTotal) * 100) : 0;

  return (
    <Link href="/platform/organizations" className="block">
      <Card className="flex h-full flex-col gap-3 p-5 transition hover:border-emerald/30 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ background: org.primaryColor || "#0a4f3f" }}
            >
              {org.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-black/80">{org.name}</p>
              <p className="truncate font-mono text-[11px] text-black/40">{org.slug}</p>
            </div>
          </div>
          <SetupRing percent={org.setupPercent} />
        </div>

        <div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-emerald-50">
            <div className="absolute inset-y-0 left-0 rounded-full bg-emerald/20" style={{ width: `${pledgedPct}%` }} />
            <div
              className={cn("absolute inset-y-0 left-0 rounded-full", thermometerPct >= 100 ? "bg-gold" : "bg-emerald")}
              style={{ width: `${thermometerPct}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-black/50">
            <span className="font-semibold text-emerald">{currency(org.collectedTotal)}</span>
            {org.goalTotal > 0 ? ` of ${currency(org.goalTotal)} goal` : " collected · no active goal"}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between text-[11px] text-black/50">
          <span>
            {org.donorCount} donor{org.donorCount === 1 ? "" : "s"} · {org.activeCampaigns} campaign{org.activeCampaigns === 1 ? "" : "s"} · {org.activeMembers} member{org.activeMembers === 1 ? "" : "s"}
          </span>
          <Badge variant={STATUS_TONE[org.status] ?? "neutral"}>{org.status}</Badge>
        </div>
      </Card>
    </Link>
  );
}

/**
 * Platform admin tile grid: one tile per tenant showing onboarding setup
 * percent (ring) and a fundraising thermometer (collected vs active goals).
 */
export function PlatformOrgTiles() {
  const [tiles, setTiles] = useState<PlatformOrgOverview[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<PlatformOrgOverview[]>("/organizations/overview")
      .then(setTiles)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!tiles) return <Spinner />;
  if (tiles.length === 0) return null;

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {tiles.map((org) => <OrgTile key={org.id} org={org} />)}
    </div>
  );
}
