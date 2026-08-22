"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Campaign, Donor, PageResponse, PaymentRecord, Pledge } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Spinner,
  currency,
  dateTime,
} from "@/components/ui";

export default function PaymentsPage() {
  const { hasPermission } = useAuth();
  const canIssueReceipt = hasPermission("receipts.issue");

  const [pageData, setPageData] = useState<PageResponse<PaymentRecord> | null>(null);
  const [page, setPage] = useState(0);
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    mode: "pledge" as "pledge" | "direct",
    pledgeId: "",
    campaignId: "",
    donorId: "",
    amount: "",
    paymentMethod: "cash",
    reference: "",
    issueReceipt: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeLive, setStripeLive] = useState<boolean | null>(null);
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api.get<PageResponse<PaymentRecord>>(`/payments?page=${page}&size=50`),
      api.get<Pledge[]>("/pledges"),
      api.get<Donor[]>("/donors"),
      api.get<Campaign[]>("/campaigns"),
    ])
      .then(([p, pl, d, c]) => {
        setPageData(p);
        setPledges(pl);
        setDonors(d);
        setCampaigns(c);
        if (pl.length) {
          setForm((f) => (f.pledgeId ? f : { ...f, pledgeId: pl[0].id }));
        }
      })
      .catch((e) => setError(e.message));
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .get<{ stripeLive: boolean }>("/payments/gateway-status")
      .then((s) => setStripeLive(s.stripeLive))
      .catch(() => setStripeLive(null));
  }, []);

  const pledgeLabel = (pledgeId: string) => {
    const p = pledges.find((x) => x.id === pledgeId);
    if (!p) return pledgeId.slice(0, 8);
    const donor = donors.find((d) => d.id === p.donorId);
    return `${donor?.fullName ?? "Donor"} — ${currency(p.amount)}`;
  };

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/payments", {
        // Pledge payment, or a direct "takaza" donation straight to a campaign.
        pledgeId: form.mode === "pledge" ? form.pledgeId : undefined,
        campaignId: form.mode === "direct" ? form.campaignId : undefined,
        donorId: form.mode === "direct" ? form.donorId : undefined,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        reference: form.reference || undefined,
        issueReceipt: form.issueReceipt,
      });
      setForm((f) => ({ ...f, amount: "", reference: "" }));
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  const issueReceipt = async (paymentId: string) => {
    await api.post(`/payments/${paymentId}/receipt`);
    load();
  };

  if (error && !pageData) return <p className="text-red-600">{error}</p>;
  if (!pageData) return <Spinner />;

  const payments = pageData.items;

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Record payments against pledges and issue receipts"
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => api.download("/export/payments", "payments.csv").catch((e) => setError(e.message))}
            >
              Export CSV
            </Button>
            <Button onClick={() => setModalOpen(true)}>Record payment</Button>
          </div>
        }
      />

      {stripeLive === false && !noticeDismissed ? (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p>
            <span className="font-semibold">Online card payments are not active.</span>{" "}
            The live Stripe account for this module has not been connected yet — donations
            can still be recorded manually below. Once the account is active, the public
            campaign pages will offer &quot;Pay now&quot; automatically.
          </p>
          <button
            className="shrink-0 text-xs font-medium text-amber-700 hover:underline"
            onClick={() => setNoticeDismissed(true)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Donor</th>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Receipt</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="px-4 py-3">{p.paymentDate}</td>
                <td className="px-4 py-3">
                  <Link href={`/donors/${p.donorId}`} className="text-emerald hover:underline">
                    {p.donorName ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-black/60">
                  {p.campaignName ?? "—"}
                  {p.campaignDay !== null ? (
                    <span className="block text-xs text-black/40">
                      Day {p.campaignDay}
                      {p.campaignDays !== null ? ` of ${p.campaignDays}` : ""}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 font-medium">{currency(p.amount)}</td>
                <td className="px-4 py-3">{p.paymentMethod ?? "—"}</td>
                <td className="px-4 py-3">
                  {p.receipt ? (
                    <Badge tone="gold">{p.receipt.receiptNumber}</Badge>
                  ) : (
                    <span className="text-slate-400">None</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {!p.receipt && canIssueReceipt && (
                    <button
                      className="text-xs text-emerald hover:underline"
                      onClick={() => issueReceipt(p.id)}
                    >
                      Issue receipt
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No payments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Pagination page={pageData.page} totalPages={pageData.totalPages} onPageChange={setPage} />

      <Modal open={modalOpen} title="Record payment" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleRecord} className="space-y-4">
          <Field label="Payment type">
            <Select
              value={form.mode}
              onChange={(e) => setForm({ ...form, mode: e.target.value as "pledge" | "direct" })}
            >
              <option value="pledge">Against a pledge</option>
              <option value="direct">Direct donation to a campaign (no pledge)</option>
            </Select>
          </Field>
          {form.mode === "pledge" ? (
            <Field label="Pledge">
              <Select
                value={form.pledgeId}
                onChange={(e) => setForm({ ...form, pledgeId: e.target.value })}
                required
              >
                {pledges.map((p) => (
                  <option key={p.id} value={p.id}>
                    {pledgeLabel(p.id)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Campaign">
                <Select
                  value={form.campaignId}
                  onChange={(e) => setForm({ ...form, campaignId: e.target.value })}
                  required
                >
                  <option value="">Select a campaign...</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Donor">
                <Select
                  value={form.donorId}
                  onChange={(e) => setForm({ ...form, donorId: e.target.value })}
                  required
                >
                  <option value="">Select a donor...</option>
                  {donors.map((d) => (
                    <option key={d.id} value={d.id}>{d.fullName}</option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount">
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </Field>
            <Field label="Method">
              <Select
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              >
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank transfer</option>
              </Select>
            </Field>
          </div>
          <Field label="Reference (check #, txn id)">
            <Input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.issueReceipt}
              onChange={(e) => setForm({ ...form, issueReceipt: e.target.checked })}
            />
            Issue receipt automatically
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Record
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
