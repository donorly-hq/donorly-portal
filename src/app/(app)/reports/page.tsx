"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { FundraisingReport } from "@/lib/types";
import { Button, Card, PageHeader, Select, Spinner, StatCard, currency } from "@/components/ui";

export default function ReportsPage() {
  const [report, setReport] = useState<FundraisingReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  const [statementYear, setStatementYear] = useState(currentYear - (new Date().getMonth() === 0 ? 1 : 0));
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const exportCsv = (path: string, name: string) =>
    api.download(path, name).catch((e) => setError(e.message));

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
        <StatCard label="Total collected" value={currency(report.totalCollected)} tone="gold" />
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
            <p className="text-3xl font-bold text-gold-dark">{currency(report.collectedThisMonth)}</p>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-emerald mb-2">Year-end giving statements</h3>
        <p className="mb-4 text-sm text-slate-500">
          Generate consolidated annual statements for every donor who gave during the
          selected year — one printable letter per donor, ready for tax filing.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={String(statementYear)}
            onChange={(e) => setStatementYear(Number(e.target.value))}
            className="w-32"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
          <Link href={`/reports/statements?year=${statementYear}`}>
            <Button type="button">Open printable statements</Button>
          </Link>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-emerald mb-2">Exports</h3>
        <p className="mb-4 text-sm text-slate-500">
          Download your data as CSV for Excel, Google Sheets, or board reports.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => exportCsv("/export/donors", "donors.csv")}>
            Donors CSV
          </Button>
          <Button variant="secondary" onClick={() => exportCsv("/export/pledges", "pledges.csv")}>
            Pledges CSV
          </Button>
          <Button variant="secondary" onClick={() => exportCsv("/export/payments", "payments.csv")}>
            Payments CSV
          </Button>
        </div>
      </Card>
    </div>
  );
}
