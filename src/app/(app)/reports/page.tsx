"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { FundraisingReport } from "@/lib/types";
import { Card, PageHeader, Spinner, StatCard, currency } from "@/components/ui";

export default function ReportsPage() {
  const [report, setReport] = useState<FundraisingReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<FundraisingReport>("/reports/fundraising")
      .then(setReport)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!report) return <Spinner />;

  const collectionRate =
    report.totalPledged > 0
      ? Math.round((report.totalCollected / report.totalPledged) * 100)
      : 0;

  const fulfillmentRate =
    report.totalPledges > 0
      ? Math.round((report.fulfilledPledges / report.totalPledges) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fundraising report"
        subtitle="Organisation-wide performance snapshot"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total donors" value={report.totalDonors} />
        <StatCard label="Active campaigns" value={report.activeCampaigns} />
        <StatCard label="Total pledged" value={currency(report.totalPledged)} />
        <StatCard label="Total collected" value={currency(report.totalCollected)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Outstanding" value={currency(report.outstanding)} hint="Pledged minus collected" />
        <StatCard label="Collection rate" value={`${collectionRate}%`} />
        <StatCard label="Pledge fulfillment" value={`${fulfillmentRate}%`} hint={`${report.fulfilledPledges} of ${report.totalPledges} pledges`} />
        <StatCard label="Open follow-ups" value={report.openFollowUps} />
      </div>

      <Card>
        <h3 className="font-semibold text-emerald mb-4">This month</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-slate-500">Payments recorded</p>
            <p className="text-3xl font-bold">{report.paymentsThisMonth}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Collected this month</p>
            <p className="text-3xl font-bold text-emerald">{currency(report.collectedThisMonth)}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
