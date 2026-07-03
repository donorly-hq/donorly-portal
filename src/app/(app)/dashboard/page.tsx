"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { AmbassadorDashboard, CampaignManagerDashboard, OrgDashboard } from "@/lib/types";
import { Card, PageHeader, Spinner, StatCard, currency } from "@/components/ui";

const ROLE_LABELS: Record<string, string> = {
  organization_owner: "Organization Owner",
  organization_admin: "Organization Admin",
  campaign_manager: "Campaign Manager",
  finance_user: "Finance User",
  ambassador: "Ambassador",
  volunteer: "Volunteer",
  donor: "Donor",
  platform_super_admin: "Platform Super Admin",
};

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

function fmtTime(t: string | null | undefined) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m));
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/* ─── org-wide snapshot ────────────────────────────────────────── */
function OrgSnapshot({ name, data }: { name: string; data: OrgDashboard }) {
  const progress =
    data.totalPledged > 0
      ? Math.round((data.totalCollected / data.totalPledged) * 100)
      : 0;

  return (
    <>
      <p className="mb-4 text-sm text-black/50">
        Welcome back, <span className="font-semibold text-black/70">{name}</span>
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total donors" value={data.totalDonors} />
        <StatCard label="Active campaigns" value={data.totalCampaigns} />
        <StatCard label="Open follow-ups" value={data.openFollowUps} />
        <StatCard label="Total pledged" value={currency(data.totalPledged)} />
        <StatCard label="Total collected" value={currency(data.totalCollected)} />
        <StatCard label="Outstanding" value={currency(data.remaining)} hint={`${progress}% collected`} />
      </div>

      <div className="mt-6 rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <p className="mb-2 text-sm font-medium text-black/60">Collection progress</p>
        <div className="h-3 w-full overflow-hidden rounded-full bg-black/5">
          <div className="h-full rounded-full bg-emerald" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-sm text-black/50">
          {currency(data.totalCollected)} collected of {currency(data.totalPledged)} pledged
        </p>
      </div>
    </>
  );
}

/* ─── ambassador personal snapshot ────────────────────────────── */
function AmbassadorSnapshot({ name, data }: { name: string; data: AmbassadorDashboard }) {
  const followUpPct =
    data.totalFollowUps > 0
      ? Math.round((data.completedFollowUps / data.totalFollowUps) * 100)
      : 0;

  const collectionPct =
    data.totalPledged > 0
      ? Math.round((data.totalCollected / data.totalPledged) * 100)
      : 0;

  return (
    <>
      <p className="mb-4 text-sm text-black/50">
        Welcome back, <span className="font-semibold text-black/70">{name}</span>
      </p>

      {/* work counters */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Assigned donors" value={data.assignedDonors} />
        <StatCard label="Open follow-ups" value={data.openFollowUps} />
        <StatCard label="Pledges recorded" value={data.pledgeCount} />
        <StatCard label="Outstanding" value={currency(data.outstanding)} hint={`${collectionPct}% collected`} />
      </div>

      {/* progress bars */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <p className="mb-1 text-sm font-medium text-black/60">Follow-up progress</p>
          <p className="mb-3 text-xs text-black/40">{data.completedFollowUps} of {data.totalFollowUps} completed</p>
          <div className="h-3 w-full overflow-hidden rounded-full bg-black/5">
            <div className="h-full rounded-full bg-emerald" style={{ width: `${followUpPct}%` }} />
          </div>
          <p className="mt-2 text-sm text-black/50">{followUpPct}% done</p>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <p className="mb-1 text-sm font-medium text-black/60">Pledge collection</p>
          <p className="mb-3 text-xs text-black/40">{currency(data.totalCollected)} of {currency(data.totalPledged)}</p>
          <div className="h-3 w-full overflow-hidden rounded-full bg-black/5">
            <div className="h-full rounded-full bg-emerald" style={{ width: `${collectionPct}%` }} />
          </div>
          <p className="mt-2 text-sm text-black/50">{collectionPct}% collected</p>
        </div>
      </div>

      {/* upcoming events */}
      <Section title="Upcoming Events">
        {data.upcomingEvents.length === 0 ? (
          <Empty text="No upcoming events." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-4">Event</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Location</th>
                <th className="py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.upcomingEvents.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{e.name}</td>
                  <td className="py-2 pr-4 capitalize text-slate-500">{e.eventType}</td>
                  <td className="py-2 pr-4 text-slate-500">{e.location ?? "—"}</td>
                  <td className="py-2 text-slate-500">{fmt(e.startsAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* upcoming townhalls */}
      <Section title="Upcoming Townhalls">
        {data.upcomingTownhalls.length === 0 ? (
          <Empty text="No upcoming townhalls." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-4">Person</th>
                <th className="py-2 pr-4">Address</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {data.upcomingTownhalls.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{t.personName}</td>
                  <td className="py-2 pr-4 text-slate-500">{t.address ?? "—"}</td>
                  <td className="py-2 pr-4 text-slate-500">{fmt(t.eventDate)}</td>
                  <td className="py-2 text-slate-500">{fmtTime(t.eventTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* active campaigns */}
      <Section title="Active Campaigns">
        {data.activeCampaigns.length === 0 ? (
          <Empty text="No active campaigns." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-4">Campaign</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Goal</th>
                <th className="py-2">Ends</th>
              </tr>
            </thead>
            <tbody>
              {data.activeCampaigns.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{c.name}</td>
                  <td className="py-2 pr-4 capitalize text-slate-500">{c.campaignType}</td>
                  <td className="py-2 pr-4 text-slate-500">{currency(c.goalAmount)}</td>
                  <td className="py-2 text-slate-500">{fmt(c.endDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mt-4 p-0">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold text-black/70">{title}</p>
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-slate-400">{text}</p>;
}

/* ─── campaign manager snapshot ───────────────────────────── */
function CampaignManagerSnapshot({ name, data }: { name: string; data: CampaignManagerDashboard }) {
  const collectionPct =
    data.totalPledged > 0 ? Math.round((data.totalCollected / data.totalPledged) * 100) : 0;

  return (
    <>
      <p className="mb-4 text-sm text-black/50">
        Welcome back, <span className="font-semibold text-black/70">{name}</span>
      </p>

      {/* counters */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My campaigns" value={data.totalManagedCampaigns} />
        <StatCard label="My ambassadors" value={data.myAmbassadors.length} />
        <StatCard label="Open follow-ups" value={data.openFollowUps} />
        <StatCard label="Outstanding" value={currency(data.outstanding)} hint={`${collectionPct}% collected`} />
      </div>

      {/* collection progress */}
      <div className="mt-4 rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <p className="mb-1 text-sm font-medium text-black/60">Pledge collection across my campaigns</p>
        <p className="mb-3 text-xs text-black/40">{currency(data.totalCollected)} of {currency(data.totalPledged)}</p>
        <div className="h-3 w-full overflow-hidden rounded-full bg-black/5">
          <div className="h-full rounded-full bg-emerald" style={{ width: `${collectionPct}%` }} />
        </div>
        <p className="mt-2 text-sm text-black/50">{collectionPct}% collected</p>
      </div>

      {/* my campaigns table */}
      <Section title="My Campaigns">
        {data.managedCampaigns.length === 0 ? (
          <Empty text="No campaigns assigned to you yet." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-4">Campaign</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Goal</th>
                <th className="py-2 pr-4">Pledged</th>
                <th className="py-2">Ends</th>
              </tr>
            </thead>
            <tbody>
              {data.managedCampaigns.map((c) => {
                const pct = c.goalAmount > 0 ? Math.round((c.collected / c.goalAmount) * 100) : 0;
                return (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{c.name}</td>
                    <td className="py-2 pr-4 capitalize text-slate-500">{c.status}</td>
                    <td className="py-2 pr-4 text-slate-500">{currency(c.goalAmount)}</td>
                    <td className="py-2 pr-4">
                      {currency(c.pledged)}
                      <span className="ml-1 text-xs text-slate-400">({pct}%)</span>
                    </td>
                    <td className="py-2 text-slate-500">{fmt(c.endDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* my ambassadors */}
      <Section title="My Ambassadors">
        {data.myAmbassadors.length === 0 ? (
          <Empty text="No ambassadors created by you yet." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.myAmbassadors.map((a) => (
                <tr key={a.userId} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{a.fullName}</td>
                  <td className="py-2 pr-4 text-slate-500">{a.email}</td>
                  <td className="py-2 capitalize text-slate-500">{a.memberStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}

/* ─── page ─────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { session, hasPermission } = useAuth();
  const canViewReports = hasPermission("reports.view");
  const isCampaignManager = session?.roleCode === "campaign_manager";

  const [orgData, setOrgData] = useState<OrgDashboard | null>(null);
  const [myData, setMyData] = useState<AmbassadorDashboard | null>(null);
  const [cmData, setCmData] = useState<CampaignManagerDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (canViewReports && !isCampaignManager) {
      api.get<OrgDashboard>("/dashboard").then(setOrgData).catch((e) => setError(e.message));
    } else if (isCampaignManager) {
      api.get<CampaignManagerDashboard>("/dashboard/campaign-manager").then(setCmData).catch((e) => setError(e.message));
    } else {
      api.get<AmbassadorDashboard>("/dashboard/my").then(setMyData).catch((e) => setError(e.message));
    }
  }, [canViewReports, isCampaignManager]);

  const roleName = session?.roleCode ? (ROLE_LABELS[session.roleCode] ?? session.roleCode) : "";

  if (error) return <p className="text-red-600 p-4">{error}</p>;
  if (canViewReports && !isCampaignManager && !orgData) return <Spinner />;
  if (isCampaignManager && !cmData) return <Spinner />;
  if (!canViewReports && !isCampaignManager && !myData) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`${roleName} — ${session?.organizationName ?? ""}`}
      />

      {canViewReports && !isCampaignManager && orgData && (
        <OrgSnapshot name={session?.fullName ?? ""} data={orgData} />
      )}

      {isCampaignManager && cmData && (
        <CampaignManagerSnapshot name={session?.fullName ?? ""} data={cmData} />
      )}

      {!canViewReports && !isCampaignManager && myData && (
        <AmbassadorSnapshot name={session?.fullName ?? ""} data={myData} />
      )}
    </div>
  );
}
