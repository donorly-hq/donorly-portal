"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { CampaignDashboard, Donor, Pledge } from "@/lib/types";
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
  StatCard,
  currency,
} from "@/components/ui";

const emptyForm = { donorId: "", amount: "", frequency: "one_time", paymentMethod: "" };

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params.id;
  const { hasPermission } = useAuth();
  const canWritePledge = hasPermission("pledges.write");

  const [dashboard, setDashboard] = useState<CampaignDashboard | null>(null);
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [reminding, setReminding] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      api.get<CampaignDashboard>(`/campaigns/${campaignId}/dashboard`),
      api.get<Pledge[]>(`/campaigns/${campaignId}/pledges`),
      api.get<Donor[]>("/donors"),
    ])
      .then(([d, p, dn]) => {
        setDashboard(d);
        setPledges(p);
        setDonors(dn);
      })
      .catch((e) => setError(e.message));
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  const donorName = (id: string) => donors.find((d) => d.id === id)?.fullName ?? "Unknown donor";

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(`/campaigns/${campaignId}/pledges`, {
        donorId: form.donorId,
        amount: Number(form.amount),
        frequency: form.frequency,
        paymentMethod: form.paymentMethod || undefined,
      });
      setForm(emptyForm);
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save pledge");
    } finally {
      setSaving(false);
    }
  };

  const markCollected = async (pledge: Pledge) => {
    await api.patch(`/pledges/${pledge.id}`, {
      collectedAmount: pledge.amount,
      status: "fulfilled",
    });
    load();
  };

  const sendReminder = async (pledge: Pledge) => {
    setReminding(pledge.id);
    setNotice(null);
    try {
      await api.post(`/pledges/${pledge.id}/remind`, {});
      setNotice(`Reminder sent to ${donorName(pledge.donorId)}.`);
      load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to send reminder");
    } finally {
      setReminding(null);
    }
  };

  if (error && !dashboard) return <p className="text-red-600">{error}</p>;
  if (!dashboard) return <Spinner />;

  const progress =
    dashboard.goalAmount > 0
      ? Math.min(100, Math.round((dashboard.collected / dashboard.goalAmount) * 100))
      : 0;

  return (
    <div>
      <PageHeader
        title={dashboard.name}
        subtitle="Campaign overview"
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={async () => {
                const url = `${window.location.origin}/t/${campaignId}`;
                await navigator.clipboard.writeText(url);
                setNotice(`Public tally link copied: ${url}`);
              }}
            >
              Copy public tally link
            </Button>
            <Link href={`/live/${campaignId}`}>
              <Button variant="secondary" type="button">Live view</Button>
            </Link>
            {canWritePledge ? (
              <Link href={`/quick-pledge?campaign=${campaignId}`}>
                <Button variant="secondary" type="button">Quick entry</Button>
              </Link>
            ) : null}
            {canWritePledge ? (
              <Button onClick={() => setModalOpen(true)} disabled={donors.length === 0}>
                Add pledge
              </Button>
            ) : null}
          </div>
        }
      />

      {notice ? (
        <p className="mt-3 rounded-lg bg-emerald/10 px-3 py-2 text-sm text-emerald">{notice}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Goal" value={currency(dashboard.goalAmount)} />
        <StatCard label="Pledged" value={currency(dashboard.pledged)} />
        <StatCard label="Collected" value={currency(dashboard.collected)} hint={`${progress}% of goal`} />
        <StatCard label="Pledges" value={dashboard.pledgeCount} />
      </div>

      <h2 className="mb-3 mt-8 text-xl text-emerald">Pledges</h2>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-black/50">
              <th className="px-4 py-3 font-medium">Donor</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Collected</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {canWritePledge ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {pledges.map((p) => (
              <tr key={p.id} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-3 font-medium text-emerald">{donorName(p.donorId)}</td>
                <td className="px-4 py-3">{currency(p.amount)}</td>
                <td className="px-4 py-3">{currency(p.collectedAmount)}</td>
                <td className="px-4 py-3">
                  <Badge tone={p.status === "fulfilled" ? "success" : "warning"}>{p.status}</Badge>
                </td>
                {canWritePledge ? (
                  <td className="px-4 py-3 text-right">
                    {p.status !== "fulfilled" ? (
                      <span className="inline-flex gap-3">
                        <button
                          className="text-xs text-amber-600 hover:underline disabled:opacity-50"
                          onClick={() => sendReminder(p)}
                          disabled={reminding === p.id}
                          title={p.lastReminderAt ? `Last reminded ${new Date(p.lastReminderAt).toLocaleDateString()}` : "Never reminded"}
                        >
                          {reminding === p.id ? "Sending..." : "Remind"}
                        </button>
                        <button
                          className="text-xs text-emerald hover:underline"
                          onClick={() => markCollected(p)}
                        >
                          Mark collected
                        </button>
                      </span>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
            {pledges.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-black/40">
                  No pledges yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      <Modal open={modalOpen} title="Add pledge" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label="Donor">
            <Select
              value={form.donorId}
              onChange={(e) => setForm({ ...form, donorId: e.target.value })}
              required
            >
              <option value="">Select a donor...</option>
              {donors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount">
              <Input
                type="number"
                min="1"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </Field>
            <Field label="Frequency">
              <Select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
              >
                <option value="one_time">One time</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </Select>
            </Field>
          </div>
          <Field label="Payment method">
            <Input
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              placeholder="e.g. cash, check, card"
            />
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save pledge"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
