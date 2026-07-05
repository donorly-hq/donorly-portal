"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Donor, PageResponse, PaymentRecord, Pledge } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
  PageHeader,
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
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    pledgeId: "",
    amount: "",
    paymentMethod: "cash",
    reference: "",
    issueReceipt: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      api.get<PageResponse<PaymentRecord>>(`/payments?page=${page}&size=50`),
      api.get<Pledge[]>("/pledges"),
      api.get<Donor[]>("/donors"),
    ])
      .then(([p, pl, d]) => {
        setPageData(p);
        setPledges(pl);
        setDonors(d);
        if (pl.length) {
          setForm((f) => (f.pledgeId ? f : { ...f, pledgeId: pl[0].id }));
        }
      })
      .catch((e) => setError(e.message));
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

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
        pledgeId: form.pledgeId,
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
        action={<Button onClick={() => setModalOpen(true)}>Record payment</Button>}
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Donor</th>
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
                <td className="px-4 py-3 font-medium">{currency(p.amount)}</td>
                <td className="px-4 py-3">{p.paymentMethod ?? "—"}</td>
                <td className="px-4 py-3">
                  {p.receipt ? (
                    <Badge tone="success">{p.receipt.receiptNumber}</Badge>
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
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No payments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {pageData.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-black/60">
          <span>
            Page {pageData.page + 1} of {pageData.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={pageData.page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={pageData.page >= pageData.totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <Modal open={modalOpen} title="Record payment" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleRecord} className="space-y-4">
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
