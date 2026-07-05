"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { YearEndStatementResponse } from "@/lib/types";
import { Button, Spinner, currency } from "@/components/ui";

export default function StatementsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <StatementsContent />
    </Suspense>
  );
}

function StatementsContent() {
  const params = useSearchParams();
  const { session } = useAuth();
  const year = Number(params.get("year")) || new Date().getFullYear() - 1;
  const [data, setData] = useState<YearEndStatementResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<YearEndStatementResponse>(`/reports/year-end?year=${year}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [year]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <Spinner />;

  const orgName = session?.organizationName ?? "Your organization";
  const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="font-serif text-2xl font-bold text-emerald">
            {year} year-end statements
          </h1>
          <p className="text-sm text-black/50">
            {data.statements.length} donor{data.statements.length === 1 ? "" : "s"} gave in{" "}
            {year}. Print this page — each statement starts on its own page.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/reports">
            <Button variant="secondary" type="button">Back to reports</Button>
          </Link>
          <Button type="button" onClick={() => window.print()} disabled={data.statements.length === 0}>
            Print all
          </Button>
        </div>
      </div>

      {data.statements.length === 0 ? (
        <p className="text-sm text-black/50">No payments were recorded in {year}.</p>
      ) : (
        data.statements.map((s) => (
          <div
            key={s.donorId}
            className="rounded-xl border border-black/10 bg-white p-8 shadow-sm print:break-after-page print:rounded-none print:border-0 print:shadow-none"
          >
            <div className="mb-6 border-b border-black/10 pb-4">
              <p className="font-serif text-xl font-bold text-emerald">{orgName}</p>
              <p className="text-sm text-black/50">Year-End Giving Statement — {year}</p>
            </div>

            <div className="mb-6">
              <p className="font-semibold">{s.donorName}</p>
              {s.city ? <p className="text-sm text-black/60">{s.city}</p> : null}
              {s.email ? <p className="text-sm text-black/60">{s.email}</p> : null}
            </div>

            <p className="mb-4 text-sm">
              Dear {s.donorName}, thank you for your generous support of {orgName} during{" "}
              {year}. This statement summarizes the contributions we received from you.
            </p>

            <table className="mb-4 w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-black/40">
                  <th className="py-2">Date</th>
                  <th className="py-2">Method</th>
                  <th className="py-2">Receipt #</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {s.payments.map((p, i) => (
                  <tr key={i} className="border-b border-black/5">
                    <td className="py-2">{dateFmt.format(new Date(p.date))}</td>
                    <td className="py-2 capitalize">{p.method ?? "—"}</td>
                    <td className="py-2">{p.receiptNumber ?? "—"}</td>
                    <td className="py-2 text-right">{currency(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="py-2" colSpan={3}>Total contributions in {year}</td>
                  <td className="py-2 text-right">{currency(s.totalGiven)}</td>
                </tr>
              </tfoot>
            </table>

            <p className="text-xs text-black/40">
              No goods or services were provided in exchange for these contributions unless
              otherwise noted. Please retain this statement for your tax records.
            </p>
          </div>
        ))
      )}
    </div>
  );
}
