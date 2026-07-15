"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { OrgUsageMetrics } from "@/lib/types";
import { Button, Card, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { RequirePermission } from "@/components/RequirePermission";
import {
  OrgAdminModals,
  OrgOwnerCell,
  OrgRowActions,
  OrgStatusBadge,
  useOrgAdmin,
} from "@/components/platform/OrgAdmin";

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1,
});

function lastActivityLabel(iso: string | null): string {
  if (!iso) return "No activity";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function PlatformOrganizationsPage() {
  return (
    <RequirePermission permission="platform.organizations.manage">
      <PlatformOrganizationsPageInner />
    </RequirePermission>
  );
}

function PlatformOrganizationsPageInner() {
  const admin = useOrgAdmin();
  const [metrics, setMetrics] = useState<Map<string, OrgUsageMetrics>>(new Map());

  useEffect(() => {
    // Metrics load separately so a slow aggregate never blocks the org list
    api.get<OrgUsageMetrics[]>("/organizations/metrics")
      .then((list) => setMetrics(new Map(list.map((m) => [m.organizationId, m]))))
      .catch(() => { /* metrics are best-effort */ });
  }, []);

  if (admin.loading) return <Spinner />;
  if (admin.error) return <p className="text-red-600">{admin.error}</p>;

  return (
    <>
      <PageHeader
        title="Organizations"
        subtitle="All tenant organizations on this platform"
        action={<Button onClick={admin.openAdd}>+ Add Organization</Button>}
      />

      {admin.orgs.length === 0 ? (
        <EmptyState
          icon="🏢"
          title="No organizations yet"
          description="Create the first organization to get started."
          action={<Button onClick={admin.openAdd}>+ Add Organization</Button>}
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs font-semibold uppercase tracking-wide text-black/40">
                <th className="px-5 py-3">Organization</th>
                <th className="px-5 py-3">Vertical</th>
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Usage</th>
                <th className="px-5 py-3">Last activity</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admin.orgs.map((org) => {
                const m = metrics.get(org.id);
                return (
                  <tr
                    key={org.id}
                    className="border-b border-black/5 last:border-0 hover:bg-emerald-50/60 transition"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium">{org.name}</p>
                      <p className="text-xs text-black/40 font-mono">{org.slug}</p>
                    </td>
                    <td className="px-5 py-3 capitalize text-black/60">{org.vertical}</td>
                    <td className="px-5 py-3"><OrgOwnerCell org={org} /></td>
                    <td className="px-5 py-3">
                      {m ? (
                        <div className="text-xs text-black/60">
                          <p>{m.activeMembers} members · {m.donorCount} donors</p>
                          <p className="text-black/40">
                            {m.activeCampaigns} active campaigns · {compactCurrency.format(m.totalCollected)} / {compactCurrency.format(m.totalPledged)} collected
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-black/30">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-black/50">
                      {m ? lastActivityLabel(m.lastActivityAt) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <OrgStatusBadge org={org} onClick={() => admin.openStatus(org)} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <OrgRowActions org={org} admin={admin} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <OrgAdminModals admin={admin} />
    </>
  );
}
