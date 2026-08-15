"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Campaign, DonorDetail, DonorTag } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  Tab,
  Tabs,
  Textarea,
  currency,
  dateTime,
} from "@/components/ui";
import { DonorAiPanel } from "@/components/donors/DonorAiPanel";

export default function DonorDetailPage() {
  const params = useParams<{ id: string }>();
  const donorId = params.id;
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("donors.write");
  const canPay = hasPermission("payments.manage");

  const [detail, setDetail] = useState<DonorDetail | null>(null);
  const [allTags, setAllTags] = useState<DonorTag[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tab, setTab] = useState("overview");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [noteText, setNoteText] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [profileForm, setProfileForm] = useState({
    occupation: "",
    employer: "",
    preferredLanguage: "",
    preferredChannel: "",
    notesPrivate: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    pledgeId: "",
    amount: "",
    paymentMethod: "cash",
    issueReceipt: true,
  });

  const load = useCallback(() => {
    Promise.all([
      api.get<DonorDetail>(`/donors/${donorId}/detail`),
      api.get<DonorTag[]>("/donor-tags").catch(() => [] as DonorTag[]),
      api.get<Campaign[]>("/campaigns").catch(() => [] as Campaign[]),
    ])
      .then(([d, tags, camps]) => {
        setDetail(d);
        setAllTags(tags);
        setCampaigns(camps);
        setProfileForm({
          occupation: d.profile.occupation ?? "",
          employer: d.profile.employer ?? "",
          preferredLanguage: d.profile.preferredLanguage ?? "",
          preferredChannel: d.profile.preferredChannel ?? "",
          notesPrivate: d.profile.notesPrivate ?? "",
        });
        if (d.pledges.length) {
          setPaymentForm((f) => (f.pledgeId ? f : { ...f, pledgeId: d.pledges[0].id }));
        }
      })
      .catch((e) => setError(e.message));
  }, [donorId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.put(`/donors/${donorId}/profile`, profileForm);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    await api.post(`/donors/${donorId}/notes`, { noteText, visibility: "team" });
    setNoteText("");
    load();
  };

  const assignTag = async (tagId: string) => {
    await api.post(`/donors/${donorId}/tags/${tagId}`);
    load();
  };

  const unassignTag = async (tagId: string) => {
    await api.delete(`/donors/${donorId}/tags/${tagId}`);
    load();
  };

  const createAndAssignTag = async () => {
    if (!newTagName.trim()) return;
    const tag = await api.post<DonorTag>("/donor-tags", { name: newTagName.trim() });
    await api.post(`/donors/${donorId}/tags/${tag.id}`);
    setNewTagName("");
    load();
  };

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/payments", {
        pledgeId: paymentForm.pledgeId,
        amount: Number(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
        issueReceipt: paymentForm.issueReceipt,
      });
      setPaymentForm((f) => ({ ...f, amount: "" }));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSaving(false);
    }
  };

  if (error && !detail) return <p className="text-red-600">{error}</p>;
  if (!detail) return <Spinner />;

  const { donor } = detail;
  const campaignName = (id: string) => campaigns.find((c) => c.id === id)?.name ?? id.slice(0, 8);
  const unassignedTags = allTags.filter((t) => !detail.tags.some((dt) => dt.id === t.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title={donor.fullName}
        subtitle={[donor.email, donor.phone, donor.city].filter(Boolean).join(" · ") || "No contact info"}
      >
        <Link href="/donors" className="text-sm text-emerald hover:underline">
          ← Back to donors
        </Link>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="!p-4">
          <p className="text-xs text-slate-500">Lifetime giving</p>
          <p className="text-2xl font-bold text-emerald">{currency(donor.lifetimeGiving)}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-500">Pledges</p>
          <p className="text-2xl font-bold">{detail.pledges.length}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-500">Open follow-ups</p>
          <p className="text-2xl font-bold">
            {detail.followUps.filter((f) => f.status === "open").length}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-500">Status</p>
          <Badge tone={donor.status === "active" ? "success" : "neutral"}>{donor.status}</Badge>
        </Card>
      </div>

      {detail.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {detail.tags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald"
            >
              {t.name}
              {canWrite && (
                <button onClick={() => unassignTag(t.id)} className="ml-1 hover:text-red-600">
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <Tabs value={tab} onChange={setTab}>
        <Tab value="overview" label="Overview" />
        <Tab value="notes" label={`Notes (${detail.notes.length})`} />
        <Tab value="pledges" label={`Pledges (${detail.pledges.length})`} />
        <Tab value="payments" label={`Payments (${detail.payments.length})`} />
      </Tabs>

      {tab === "overview" && <DonorAiPanel detail={detail} onChanged={load} />}

      {tab === "overview" && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <h3 className="font-semibold text-emerald mb-4">Profile</h3>
            {canWrite ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Occupation">
                    <Input
                      value={profileForm.occupation}
                      onChange={(e) => setProfileForm({ ...profileForm, occupation: e.target.value })}
                    />
                  </Field>
                  <Field label="Employer">
                    <Input
                      value={profileForm.employer}
                      onChange={(e) => setProfileForm({ ...profileForm, employer: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Preferred language">
                    <Input
                      value={profileForm.preferredLanguage}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, preferredLanguage: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Preferred channel">
                    <Select
                      value={profileForm.preferredChannel}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, preferredChannel: e.target.value })
                      }
                    >
                      <option value="">—</option>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="sms">SMS</option>
                      <option value="in_person">In person</option>
                    </Select>
                  </Field>
                </div>
                <Field label="Private notes">
                  <Textarea
                    rows={3}
                    value={profileForm.notesPrivate}
                    onChange={(e) => setProfileForm({ ...profileForm, notesPrivate: e.target.value })}
                  />
                </Field>
                <Button onClick={saveProfile} loading={saving}>
                  Save profile
                </Button>
              </div>
            ) : (
              <dl className="space-y-2 text-sm">
                <div><dt className="text-slate-500">Occupation</dt><dd>{detail.profile.occupation ?? "—"}</dd></div>
                <div><dt className="text-slate-500">Employer</dt><dd>{detail.profile.employer ?? "—"}</dd></div>
                <div><dt className="text-slate-500">Preferred channel</dt><dd>{detail.profile.preferredChannel ?? "—"}</dd></div>
              </dl>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold text-emerald mb-4">Tags & assignments</h3>
            {canWrite && (
              <div className="mb-4 space-y-3">
                {unassignedTags.length > 0 && (
                  <Field label="Add existing tag">
                    <Select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) assignTag(e.target.value);
                        e.target.value = "";
                      }}
                    >
                      <option value="">Select a tag…</option>
                      {unassignedTags.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </Select>
                  </Field>
                )}
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder="New tag name"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                  />
                  <Button type="button" onClick={createAndAssignTag} disabled={!newTagName.trim()}>
                    Create & add
                  </Button>
                </div>
              </div>
            )}
            <p className="text-sm font-medium text-slate-600 mb-2">Ambassadors</p>
            {detail.assignments.length === 0 ? (
              <p className="text-sm text-slate-400">No ambassadors assigned.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {detail.assignments.map((a) => (
                  <li key={a.id} className="rounded bg-slate-50 px-3 py-2">
                    {a.ambassadorName ?? a.ambassadorUserId}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "notes" && (
        <Card>
          {canWrite && (
            <div className="mb-6 flex gap-3">
              <Textarea
                className="flex-1"
                rows={2}
                placeholder="Add a note…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              <Button onClick={addNote} disabled={!noteText.trim()}>
                Add note
              </Button>
            </div>
          )}
          <div className="space-y-3">
            {detail.notes.length === 0 ? (
              <p className="text-sm text-slate-400">No notes yet.</p>
            ) : (
              detail.notes.map((n) => (
                <div key={n.id} className="rounded-lg border border-slate-100 p-4">
                  <p className="text-sm whitespace-pre-line">{n.noteText}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {n.createdByName ?? "Staff"} · {dateTime(n.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {tab === "pledges" && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Collected</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {detail.pledges.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{campaignName(p.campaignId)}</td>
                  <td className="px-4 py-3">{currency(p.amount)}</td>
                  <td className="px-4 py-3">{currency(p.collectedAmount)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={p.status === "fulfilled" ? "gold" : "neutral"}>{p.status}</Badge>
                  </td>
                </tr>
              ))}
              {detail.pledges.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">No pledges.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "payments" && (
        <div className="space-y-4">
          {canPay && detail.pledges.length > 0 && (
            <Card>
              <h3 className="font-semibold text-emerald mb-4">Record payment</h3>
              <form onSubmit={recordPayment} className="grid md:grid-cols-4 gap-4 items-end">
                <Field label="Pledge">
                  <Select
                    value={paymentForm.pledgeId}
                    onChange={(e) => setPaymentForm({ ...paymentForm, pledgeId: e.target.value })}
                    required
                  >
                    {detail.pledges.map((p) => (
                      <option key={p.id} value={p.id}>
                        {campaignName(p.campaignId)} — {currency(p.amount)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Amount">
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Method">
                  <Select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  >
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank transfer</option>
                  </Select>
                </Field>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={paymentForm.issueReceipt}
                      onChange={(e) =>
                        setPaymentForm({ ...paymentForm, issueReceipt: e.target.checked })
                      }
                    />
                    Issue receipt
                  </label>
                  <Button type="submit" loading={saving}>
                    Record
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {detail.payments.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-4 py-3">{p.paymentDate}</td>
                    <td className="px-4 py-3">{currency(p.amount)}</td>
                    <td className="px-4 py-3">{p.paymentMethod ?? "—"}</td>
                    <td className="px-4 py-3">
                      {p.receipt ? (
                        <Badge tone="gold">{p.receipt.receiptNumber}</Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                {detail.payments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">No payments recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}
