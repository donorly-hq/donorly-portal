"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { BRAND } from "@/lib/color";
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
  const [eventModeOpen, setEventModeOpen] = useState(false);
  const [selfPledgeQr, setSelfPledgeQr] = useState<string | null>(null);

  useEffect(() => {
    if (!eventModeOpen || selfPledgeQr) return;
    QRCode.toDataURL(`${window.location.origin}/p/${campaignId}`, {
      width: 480,
      margin: 1,
      color: { dark: BRAND.emeraldDark, light: BRAND.white },
    })
      .then(setSelfPledgeQr)
      .catch(() => setSelfPledgeQr(null));
  }, [eventModeOpen, selfPledgeQr, campaignId]);

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
    // Collected totals are derived from recorded payments (never set directly), so
    // "mark collected" records a payment for the outstanding balance. The backend
    // then fulfills the pledge and issues a receipt.
    const outstanding = pledge.amount - (pledge.collectedAmount ?? 0);
    if (outstanding <= 0) return;
    await api.post(`/payments`, {
      pledgeId: pledge.id,
      amount: outstanding,
      paymentMethod: pledge.paymentMethod ?? "other",
      issueReceipt: true,
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
            <Button type="button" onClick={() => setEventModeOpen(true)}>
              Event Mode
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
              <Button
                variant="secondary"
                onClick={() => setModalOpen(true)}
                disabled={donors.length === 0}
              >
                Add pledge
              </Button>
            ) : null}
          </div>
        }
      />

      {notice ? (
        <p className="mt-3 rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald">{notice}</p>
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
                <td className="px-4 py-3 font-medium text-emerald">
                  {donorName(p.donorId)}
                  {p.source === "self" ? (
                    <span className="ml-2 rounded-full bg-gold-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-dark">
                      self
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">{currency(p.amount)}</td>
                <td className="px-4 py-3">{currency(p.collectedAmount)}</td>
                <td className="px-4 py-3">
                  <Badge tone={p.status === "fulfilled" ? "gold" : "warning"}>{p.status}</Badge>
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

      <Modal open={eventModeOpen} title="Event Mode" onClose={() => setEventModeOpen(false)}>
        <div className="space-y-5">
          <p className="text-sm text-black/60">
            Everything you need to run this campaign at a live event.
          </p>

          <div className="rounded-xl border border-black/10 p-4">
            <p className="font-medium text-emerald">1. Projector screen</p>
            <p className="mt-1 text-sm text-black/55">
              Put the live tally on the big screen. Updates by itself as pledges come in.
            </p>
            <div className="mt-3 flex gap-2">
              <a href={`/t/${campaignId}`} target="_blank" rel="noreferrer">
                <Button variant="secondary" type="button">Open tally screen</Button>
              </a>
              <Button
                variant="secondary"
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(`${window.location.origin}/t/${campaignId}`);
                  setNotice("Tally screen link copied.");
                  setEventModeOpen(false);
                }}
              >
                Copy link
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-black/10 p-4">
            <p className="font-medium text-emerald">2. Volunteer quick entry</p>
            <p className="mt-1 text-sm text-black/55">
              Volunteers with tablets record pledges in seconds — name, phone, amount.
            </p>
            <div className="mt-3">
              <Link href={`/quick-pledge?campaign=${campaignId}`}>
                <Button variant="secondary" type="button">Open quick entry</Button>
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-gold/25 bg-gold-50/50 p-4">
            <p className="font-medium text-emerald">3. Donor self-pledge QR</p>
            <p className="mt-1 text-sm text-black/55">
              Print this QR or leave it on the screen — donors scan it and pledge from
              their own phones. No app, no login.
            </p>
            {selfPledgeQr ? (
              <div className="mt-3 flex flex-col items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selfPledgeQr} alt="Self-pledge QR code" className="h-44 w-44 rounded-lg border border-black/10 bg-white p-2" />
                <div className="mt-3 flex gap-2">
                  <a href={`/p/${campaignId}`} target="_blank" rel="noreferrer">
                    <Button variant="secondary" type="button">Preview donor page</Button>
                  </a>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(`${window.location.origin}/p/${campaignId}`);
                      setNotice("Self-pledge link copied.");
                      setEventModeOpen(false);
                    }}
                  >
                    Copy link
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-black/40">Generating QR…</p>
            )}
          </div>
        </div>
      </Modal>

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
