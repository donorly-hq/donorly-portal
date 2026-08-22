"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { BRAND } from "@/lib/color";
import type {
  CampaignAudience,
  CampaignDashboard,
  CampaignMessaging,
  Donor,
  DonorTag,
  Pledge,
} from "@/lib/types";
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
  Tab,
  Tabs,
  Textarea,
  currency,
} from "@/components/ui";

const emptyForm = { donorId: "", amount: "", frequency: "one_time", paymentMethod: "" };

const ALL_CHANNELS = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "sms", label: "SMS" },
  { key: "robocall", label: "Robocall" },
  { key: "email", label: "Email" },
];

/** Days from now until the end date (floored at 0), or null without one. */
function daysLeft(endDate: string | null): number | null {
  if (!endDate) return null;
  const diff = new Date(`${endDate}T23:59:59`).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params.id;
  const { hasPermission } = useAuth();
  const canWritePledge = hasPermission("pledges.write");
  const canManage = hasPermission("campaigns.manage");

  const [dashboard, setDashboard] = useState<CampaignDashboard | null>(null);
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [audience, setAudience] = useState<CampaignAudience | null>(null);
  const [messaging, setMessaging] = useState<CampaignMessaging | null>(null);
  const [tags, setTags] = useState<DonorTag[]>([]);
  const [tab, setTab] = useState("overview");
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [reminding, setReminding] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [eventModeOpen, setEventModeOpen] = useState(false);
  const [selfPledgeQr, setSelfPledgeQr] = useState<string | null>(null);

  // Audience form
  const [targetMode, setTargetMode] = useState<"donor" | "tag" | "state">("donor");
  const [targetDonorId, setTargetDonorId] = useState("");
  const [targetTagId, setTargetTagId] = useState("");
  const [targetState, setTargetState] = useState("");
  const [addingTarget, setAddingTarget] = useState(false);

  // Messaging form (mirrors the saved config)
  const [msgForm, setMsgForm] = useState({
    messageContent: "",
    flyerUrl: "",
    paymentLink: "",
    frequency: "weekly",
    channels: ["email"] as string[],
    personalized: true,
  });
  const [savingMsg, setSavingMsg] = useState(false);

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
      api.get<CampaignAudience>(`/campaigns/${campaignId}/audience`),
      api.get<CampaignMessaging>(`/campaigns/${campaignId}/messaging`),
      api.get<DonorTag[]>("/donor-tags").catch(() => [] as DonorTag[]),
    ])
      .then(([d, p, dn, aud, msg, tg]) => {
        setDashboard(d);
        setPledges(p);
        setDonors(dn);
        setAudience(aud);
        setMessaging(msg);
        setTags(tg);
        setMsgForm({
          messageContent: msg.messageContent ?? "",
          flyerUrl: msg.flyerUrl ?? "",
          paymentLink: msg.paymentLink ?? "",
          frequency: msg.frequency,
          channels: msg.channels.length ? msg.channels : ["email"],
          personalized: msg.personalized,
        });
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

  const addTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingTarget(true);
    setNotice(null);
    try {
      const body =
        targetMode === "donor"
          ? { donorId: targetDonorId }
          : targetMode === "tag"
            ? { tagId: targetTagId }
            : { state: targetState };
      const updated = await api.post<CampaignAudience>(`/campaigns/${campaignId}/audience`, body);
      setAudience(updated);
      setTargetDonorId("");
      setTargetTagId("");
      setTargetState("");
      // Refresh the header count too.
      api.get<CampaignDashboard>(`/campaigns/${campaignId}/dashboard`).then(setDashboard);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to add audience");
    } finally {
      setAddingTarget(false);
    }
  };

  const removeTarget = async (targetId: string) => {
    const updated = await api.delete<CampaignAudience>(
      `/campaigns/${campaignId}/audience/${targetId}`,
    );
    setAudience(updated);
    api.get<CampaignDashboard>(`/campaigns/${campaignId}/dashboard`).then(setDashboard);
  };

  const toggleChannel = (key: string) => {
    setMsgForm((f) => ({
      ...f,
      channels: f.channels.includes(key)
        ? f.channels.filter((c) => c !== key)
        : [...f.channels, key],
    }));
  };

  const saveMessaging = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMsg(true);
    setNotice(null);
    try {
      const updated = await api.put<CampaignMessaging>(`/campaigns/${campaignId}/messaging`, {
        messageContent: msgForm.messageContent || null,
        flyerUrl: msgForm.flyerUrl || null,
        paymentLink: msgForm.paymentLink || null,
        frequency: msgForm.frequency,
        channels: msgForm.channels,
        personalized: msgForm.personalized,
      });
      setMessaging(updated);
      setNotice("Messaging settings saved.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to save messaging settings");
    } finally {
      setSavingMsg(false);
    }
  };

  if (error && !dashboard) return <p className="text-red-600">{error}</p>;
  if (!dashboard) return <Spinner />;

  const progress =
    dashboard.goalAmount > 0
      ? Math.min(100, Math.round((dashboard.collected / dashboard.goalAmount) * 100))
      : 0;
  const pledgedPct =
    dashboard.goalAmount > 0
      ? Math.min(100, Math.round((dashboard.pledged / dashboard.goalAmount) * 100))
      : 0;
  const remaining = daysLeft(dashboard.endDate) ?? dashboard.daysRemaining;

  return (
    <div>
      <PageHeader
        title={dashboard.name}
        subtitle={
          <span className="inline-flex items-center gap-2">
            Campaign overview
            <Badge tone={dashboard.status === "active" ? "success" : "neutral"}>
              {dashboard.status}
            </Badge>
          </span>
        }
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

      {/* Core four: goal, collected, donors targeted, countdown — always visible. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Goal" value={currency(dashboard.goalAmount)} />
        <StatCard label="Collected" value={currency(dashboard.collected)} hint={`${progress}% of goal`} />
        <StatCard label="Donors targeted" value={audience?.targetedDonorCount ?? dashboard.donorsTargeted} />
        <StatCard
          label="Days remaining"
          value={remaining !== null && remaining !== undefined ? remaining : "—"}
          hint={dashboard.endDate ? `Ends ${new Date(dashboard.endDate).toLocaleDateString()}` : "No end date set"}
        />
      </div>

      {/* Pledged vs collected, side by side against the same goal. */}
      <Card className="mt-4">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium text-emerald">Pledged</span>
              <span className="text-black/50">{currency(dashboard.pledged)} · {pledgedPct}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-black/10">
              <div className="h-full rounded-full bg-gold" style={{ width: `${pledgedPct}%` }} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium text-emerald">Collected</span>
              <span className="text-black/50">{currency(dashboard.collected)} · {progress}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-black/10">
              <div className="h-full rounded-full bg-emerald" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-8">
        <Tabs value={tab} onChange={setTab}>
          <Tab value="overview" label={`Pledges (${pledges.length})`} />
          <Tab value="audience" label={`Audience (${audience?.targets.length ?? 0})`} />
          <Tab value="messaging" label="Messaging" />
        </Tabs>
      </div>

      {tab === "overview" ? (
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
      ) : null}

      {tab === "audience" ? (
        <div className="space-y-4">
          <Card>
            <p className="text-sm text-black/55">
              Target donors individually, by group, or by state. The campaign reaches{" "}
              <span className="font-semibold text-emerald">
                {audience?.targetedDonorCount ?? 0} donor
                {(audience?.targetedDonorCount ?? 0) === 1 ? "" : "s"}
              </span>{" "}
              — the distinct set across all selectors, updated live as groups change.
            </p>
            {canManage ? (
              <form onSubmit={addTarget} className="mt-4 flex flex-wrap items-end gap-3">
                <Field label="Target by">
                  <Select
                    value={targetMode}
                    onChange={(e) => setTargetMode(e.target.value as typeof targetMode)}
                  >
                    <option value="donor">Individual donor</option>
                    <option value="tag">Group</option>
                    <option value="state">State</option>
                  </Select>
                </Field>
                {targetMode === "donor" ? (
                  <Field label="Donor">
                    <Select
                      value={targetDonorId}
                      onChange={(e) => setTargetDonorId(e.target.value)}
                      required
                    >
                      <option value="">Select a donor...</option>
                      {donors.map((d) => (
                        <option key={d.id} value={d.id}>{d.fullName}</option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                {targetMode === "tag" ? (
                  <Field label="Group">
                    <Select
                      value={targetTagId}
                      onChange={(e) => setTargetTagId(e.target.value)}
                      required
                    >
                      <option value="">Select a group...</option>
                      {tags.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                {targetMode === "state" ? (
                  <Field label="State">
                    <Input
                      value={targetState}
                      onChange={(e) => setTargetState(e.target.value)}
                      placeholder="e.g. Texas"
                      required
                    />
                  </Field>
                ) : null}
                <Button type="submit" disabled={addingTarget}>
                  {addingTarget ? "Adding..." : "Add to audience"}
                </Button>
              </form>
            ) : null}
          </Card>

          <Card className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 text-left text-black/50">
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  {canManage ? <th className="px-4 py-3" /> : null}
                </tr>
              </thead>
              <tbody>
                {(audience?.targets ?? []).map((t) => (
                  <tr key={t.id} className="border-b border-black/5 last:border-0">
                    <td className="px-4 py-3">
                      <Badge tone="neutral">
                        {t.donorId ? "Donor" : t.tagId ? "Group" : "State"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-medium text-emerald">
                      {t.donorName ?? t.tagName ?? t.state}
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3 text-right">
                        <button
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => removeTarget(t.id)}
                        >
                          Remove
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {(audience?.targets.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-black/40">
                      No audience selected yet — this campaign targets no one.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Card>
        </div>
      ) : null}

      {tab === "messaging" ? (
        <Card>
          <form onSubmit={saveMessaging} className="max-w-2xl space-y-4">
            <Field label="Message content">
              <Textarea
                rows={5}
                value={msgForm.messageContent}
                onChange={(e) => setMsgForm({ ...msgForm, messageContent: e.target.value })}
                placeholder={"Assalamu alaikum {{donor_name}}, support {{campaign_name}}! Donate here: {{payment_link}}"}
                disabled={!canManage}
              />
            </Field>
            <p className="-mt-2 text-xs text-black/40">
              Personalization variables: <code>{"{{donor_name}}"}</code>,{" "}
              <code>{"{{campaign_name}}"}</code>, <code>{"{{payment_link}}"}</code>
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Flyer URL">
                <Input
                  value={msgForm.flyerUrl}
                  onChange={(e) => setMsgForm({ ...msgForm, flyerUrl: e.target.value })}
                  placeholder="https://... (default flyer used if empty)"
                  disabled={!canManage}
                />
              </Field>
              <Field label="Payment link">
                <Input
                  value={msgForm.paymentLink}
                  onChange={(e) => setMsgForm({ ...msgForm, paymentLink: e.target.value })}
                  placeholder="https://..."
                  disabled={!canManage}
                />
              </Field>
            </div>
            <Field label="Send frequency">
              <Select
                value={msgForm.frequency}
                onChange={(e) => setMsgForm({ ...msgForm, frequency: e.target.value })}
                disabled={!canManage}
              >
                <option value="daily">Daily</option>
                <option value="every_2_days">Every 2 days</option>
                <option value="weekly">Weekly</option>
              </Select>
            </Field>
            <Field label="Channels">
              <div className="flex flex-wrap gap-4">
                {ALL_CHANNELS.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={msgForm.channels.includes(c.key)}
                      onChange={() => toggleChannel(c.key)}
                      disabled={!canManage}
                      className="h-4 w-4 accent-emerald-700"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={msgForm.personalized}
                onChange={(e) => setMsgForm({ ...msgForm, personalized: e.target.checked })}
                disabled={!canManage}
                className="h-4 w-4 accent-emerald-700"
              />
              Personalize each message with the donor&apos;s name
            </label>
            {messaging?.lastSentAt ? (
              <p className="text-xs text-black/40">
                Last sent {new Date(messaging.lastSentAt).toLocaleString()}
              </p>
            ) : null}
            {canManage ? (
              <div className="flex justify-end">
                <Button type="submit" disabled={savingMsg}>
                  {savingMsg ? "Saving..." : "Save messaging settings"}
                </Button>
              </div>
            ) : null}
          </form>
        </Card>
      ) : null}

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
