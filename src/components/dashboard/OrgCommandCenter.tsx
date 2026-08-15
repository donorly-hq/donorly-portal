"use client";

import Link from "next/link";
import type { OrgDashboard, SetupProgress } from "@/lib/types";
import { Badge, Button, Card, StatCard, cn, currency } from "@/components/ui";
import { AiSuggestionsCard } from "@/components/dashboard/AiSuggestionsCard";
import { SetupTileGrid } from "@/components/dashboard/SetupTileGrid";
import { SuggestedRemindersCard } from "@/components/dashboard/SuggestedRemindersCard";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

/**
 * Horizontal thermometer: solid emerald fill = collected, lighter overlay
 * marker = pledged. Fill turns gold when the goal is reached.
 */
function Thermometer({ goal, pledged, collected }: { goal: number; pledged: number; collected: number }) {
  const collectedPct = goal > 0 ? Math.min(100, (collected / goal) * 100) : 0;
  const pledgedPct = goal > 0 ? Math.min(100, (pledged / goal) * 100) : 0;
  return (
    <div className="relative h-4 w-full overflow-hidden rounded-full bg-emerald-50">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-emerald/20 transition-all duration-700"
        style={{ width: `${pledgedPct}%` }}
      />
      <div
        className={cn(
          "absolute inset-y-0 left-0 rounded-full transition-all duration-700",
          collectedPct >= 100 ? "bg-gold" : "bg-emerald",
        )}
        style={{ width: `${collectedPct}%` }}
      />
    </div>
  );
}

function CampaignThermometers({ campaigns }: { campaigns: OrgDashboard["campaigns"] }) {
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
        <p className="text-sm font-semibold text-black/70">Campaign progress</p>
        <Link href="/campaigns" className="text-xs font-semibold text-emerald hover:underline">
          View all
        </Link>
      </div>
      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
          <p className="text-sm text-black/40">No active campaigns yet.</p>
          <Link href="/campaigns"><Button size="sm">Create your first campaign</Button></Link>
        </div>
      ) : (
        <ul className="divide-y divide-black/5">
          {campaigns.map((c) => {
            const pct = c.goalAmount > 0 ? Math.round((c.collected / c.goalAmount) * 100) : 0;
            return (
              <li key={c.id} className="px-5 py-4">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <Link href={`/campaigns/${c.id}`} className="truncate text-sm font-medium text-black/80 hover:text-emerald">
                    {c.name}
                  </Link>
                  <span className="shrink-0 text-xs text-black/40">
                    {c.endDate ? `ends ${fmtDate(c.endDate)}` : "no end date"}
                  </span>
                </div>
                <Thermometer goal={c.goalAmount} pledged={c.pledged} collected={c.collected} />
                <div className="mt-1.5 flex items-baseline justify-between text-xs">
                  <span className="text-black/50">
                    <span className="font-semibold text-emerald">{currency(c.collected)}</span>
                    {" collected · "}{currency(c.pledged)} pledged
                  </span>
                  <span className="font-semibold text-black/60">{pct}% of {currency(c.goalAmount)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function RecentDonations({ payments }: { payments: OrgDashboard["recentPayments"] }) {
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
        <p className="text-sm font-semibold text-black/70">Recent donations</p>
        <Link href="/payments" className="text-xs font-semibold text-emerald hover:underline">
          View all
        </Link>
      </div>
      {payments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
          <p className="text-sm text-black/40">No payments recorded yet.</p>
          <Link href="/payments"><Button size="sm" variant="secondary">Record a payment</Button></Link>
        </div>
      ) : (
        <ul className="divide-y divide-black/5">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-black/80">{p.donorName}</p>
                <p className="text-xs text-black/40">
                  {fmtDate(p.paymentDate)}{p.paymentMethod ? ` · ${p.paymentMethod}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold text-gold-dark">{currency(p.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function NeedsAttention({ data }: { data: OrgDashboard }) {
  const now = Date.now();
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
        <p className="text-sm font-semibold text-black/70">Needs attention</p>
        <Link href="/follow-ups" className="text-xs font-semibold text-emerald hover:underline">
          All follow-ups
        </Link>
      </div>
      <div className="px-5 py-3">
        {data.dueFollowUps.length === 0 && data.outstandingPledges === 0 ? (
          <p className="py-6 text-center text-sm text-black/40">
            All clear — nothing needs your attention right now.
          </p>
        ) : (
          <ul className="divide-y divide-black/5">
            {data.dueFollowUps.map((f) => {
              const overdue = f.dueAt != null && new Date(f.dueAt).getTime() < now;
              return (
                <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/donors/${f.donorId}`} className="block truncate text-sm font-medium text-black/80 hover:text-emerald">
                      {f.donorName}
                    </Link>
                    {f.notes && <p className="truncate text-xs text-black/40">{f.notes}</p>}
                  </div>
                  <Badge variant={overdue ? "danger" : "warning"}>
                    {f.dueAt ? (overdue ? "overdue" : `due ${fmtDate(f.dueAt)}`) : "no due date"}
                  </Badge>
                </li>
              );
            })}
            {data.outstandingPledges > 0 && (
              <li className="flex items-center justify-between gap-3 py-2.5">
                <p className="text-sm text-black/70">
                  <span className="font-semibold">{data.outstandingPledges}</span>
                  {" "}pledge{data.outstandingPledges === 1 ? "" : "s"} with an uncollected balance
                </p>
                <Link href="/pledge-cards" className="text-xs font-semibold text-emerald hover:underline">
                  Review
                </Link>
              </li>
            )}
          </ul>
        )}
      </div>
    </Card>
  );
}

function QuickActions() {
  const actions = [
    { label: "Add donor", href: "/donors" },
    { label: "Quick pledge", href: "/quick-pledge" },
    { label: "Record payment", href: "/payments" },
    { label: "New campaign", href: "/campaigns" },
  ];
  return (
    <Card className="p-5">
      <p className="mb-3 text-sm font-semibold text-black/70">Quick actions</p>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a) => (
          <Link key={a.href} href={a.href}>
            <Button size="sm" variant="secondary" className="w-full">{a.label}</Button>
          </Link>
        ))}
      </div>
    </Card>
  );
}

/**
 * Command-center dashboard for organization owners and admins: setup tiles
 * while onboarding, then KPIs, campaign thermometers, the attention feed and
 * recent donations — all from one /dashboard payload plus /dashboard/setup.
 */
export function OrgCommandCenter({
  name,
  orgName,
  data,
  setup,
}: {
  name: string;
  orgName: string;
  data: OrgDashboard;
  setup: SetupProgress | null;
}) {
  const collectionPct =
    data.totalPledged > 0 ? Math.round((data.totalCollected / data.totalPledged) * 100) : 0;

  return (
    <>
      <p className="mb-6 text-sm text-black/50">
        {greeting()}, <span className="font-semibold text-black/70">{name}</span>
        {" — here's what's happening at "}
        <span className="font-semibold text-black/70">{orgName}</span>.
      </p>

      {setup && <SetupTileGrid progress={setup} />}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total donors" value={data.totalDonors} />
        <StatCard label="Active campaigns" value={data.campaigns.length} />
        <StatCard label="Total collected" value={currency(data.totalCollected)} tone="gold" />
        <StatCard
          label="Outstanding"
          value={currency(data.remaining)}
          hint={`${collectionPct}% of pledges collected`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <CampaignThermometers campaigns={data.campaigns} />
          <SuggestedRemindersCard />
          <RecentDonations payments={data.recentPayments} />
        </div>
        <div className="flex flex-col gap-6">
          <AiSuggestionsCard />
          <NeedsAttention data={data} />
          <QuickActions />
        </div>
      </div>
    </>
  );
}
