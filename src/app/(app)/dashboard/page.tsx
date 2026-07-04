"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type {
  AmbassadorDashboard,
  CampaignManagerDashboard,
  OrgDashboard,
  Organization,
  OrganizationRequest,
} from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  StatCard,
  currency,
} from "@/components/ui";

const ROLE_LABELS: Record<string, string> = {
  organization_owner: "Organization Owner",
  organization_admin: "Organization Admin",
  campaign_manager: "Campaign Manager",
  finance_user: "Finance User",
  ambassador: "Ambassador",
  volunteer: "Volunteer",
  donor: "Donor",
  platform_super_admin: "Platform Super Admin",
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

function fmtTime(t: string | null | undefined) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m));
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ─── constants ────────────────────────────────────────────────────────────────

const VERTICALS = [
  "nonprofit", "mosque", "church", "synagogue",
  "temple", "charity", "clinic", "other",
];
const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Phoenix", "America/Anchorage",
  "Pacific/Honolulu", "Europe/London", "Europe/Paris",
  "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata",
  "Asia/Dhaka", "Asia/Singapore", "Australia/Sydney",
];
const STATUSES = ["trial", "active", "suspended", "cancelled"];
const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  active: "success", trial: "warning", suspended: "danger", cancelled: "neutral",
};
const EMPTY_FORM: OrganizationRequest = {
  name: "", slug: "", vertical: "nonprofit", timezone: "America/Chicago",
  logoUrl: "", primaryColor: "", ownerName: "", ownerEmail: "", ownerPassword: "",
};

// ─── Platform Super Admin Dashboard ───────────────────────────────────────────

function PlatformAdminDashboard({ name }: { name: string }) {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // add / edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OrganizationRequest>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // status modal
  const [statusOrg, setStatusOrg] = useState<Organization | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  // set owner modal
  const [ownerOrg, setOwnerOrg] = useState<Organization | null>(null);
  const [ownerForm, setOwnerForm] = useState({ ownerName: "", ownerEmail: "", ownerPassword: "" });
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);
  const [savingOwner, setSavingOwner] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.get<Organization[]>("/organizations")
      .then(setOrgs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowPassword(false);
    setModalOpen(true);
  }

  function openEdit(org: Organization) {
    setEditingId(org.id);
    setForm({
      name: org.name, slug: org.slug, vertical: org.vertical,
      timezone: org.timezone, logoUrl: org.logoUrl ?? "",
      primaryColor: org.primaryColor ?? "",
    });
    setFormError(null);
    setModalOpen(true);
  }

  function setField<K extends keyof OrganizationRequest>(key: K, value: OrganizationRequest[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleNameChange(n: string) {
    setForm((f) => ({ ...f, name: n, slug: editingId ? f.slug : slugify(n) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const payload: OrganizationRequest = {
      ...form,
      logoUrl: form.logoUrl || undefined,
      primaryColor: form.primaryColor || undefined,
    };
    if (editingId) {
      delete payload.ownerName;
      delete payload.ownerEmail;
      delete payload.ownerPassword;
    }
    try {
      if (editingId) {
        const updated = await api.put<Organization>(`/organizations/${editingId}`, payload);
        setOrgs((prev) => prev.map((o) => (o.id === editingId ? updated : o)));
      } else {
        const created = await api.post<Organization>("/organizations", payload);
        setOrgs((prev) => [...prev, created]);
      }
      setModalOpen(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetOwner(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerOrg) return;
    setSavingOwner(true);
    setOwnerError(null);
    try {
      const updated = await api.put<Organization>(`/organizations/${ownerOrg.id}/owner`, ownerForm);
      setOrgs((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setOwnerOrg(null);
    } catch (e: unknown) {
      setOwnerError(e instanceof Error ? e.message : "Failed to set owner");
    } finally {
      setSavingOwner(false);
    }
  }

  async function handleStatusSave() {
    if (!statusOrg || !newStatus) return;
    setSavingStatus(true);
    try {
      const updated = await api.patch<Organization>(
        `/organizations/${statusOrg.id}/status`, { status: newStatus },
      );
      setOrgs((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setStatusOrg(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setSavingStatus(false);
    }
  }

  // stats
  const total = orgs.length;
  const active = orgs.filter((o) => o.status === "active").length;
  const trial = orgs.filter((o) => o.status === "trial").length;
  const suspended = orgs.filter((o) => o.status === "suspended").length;
  const noOwner = orgs.filter((o) => !o.ownerId).length;

  if (loading) return <Spinner />;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <>
      <p className="mb-6 text-sm text-black/50">
        Welcome back, <span className="font-semibold text-black/70">{name}</span>. You have full platform access.
      </p>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5 mb-8">
        <StatCard label="Total organizations" value={total} />
        <StatCard label="Active" value={active} />
        <StatCard label="Trial" value={trial} />
        <StatCard label="Suspended" value={suspended} />
        <StatCard label="No owner yet" value={noOwner} />
      </div>

      {/* ── Organizations table ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-black/80">All Organizations</h2>
          <p className="text-xs text-black/40 mt-0.5">Manage tenants, owners, and subscription status</p>
        </div>
        <Button onClick={openAdd}>+ Add Organization</Button>
      </div>

      {orgs.length === 0 ? (
        <EmptyState
          icon="🏢"
          title="No organizations yet"
          description="Create the first organization to get started."
          action={<Button onClick={openAdd}>+ Add Organization</Button>}
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs font-semibold uppercase tracking-wide text-black/40">
                <th className="px-5 py-3">Organization</th>
                <th className="px-5 py-3">Vertical</th>
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr key={org.id} className="border-b border-black/5 last:border-0 hover:bg-black/[.02] transition">
                  <td className="px-5 py-3">
                    <p className="font-medium">{org.name}</p>
                    <p className="text-xs text-black/40 font-mono">{org.slug}</p>
                  </td>
                  <td className="px-5 py-3 capitalize text-black/60">{org.vertical}</td>
                  <td className="px-5 py-3">
                    {org.ownerName ? (
                      <>
                        <p className="font-medium">{org.ownerName}</p>
                        <p className="text-xs text-black/40">{org.ownerEmail}</p>
                      </>
                    ) : (
                      <span className="text-xs text-amber-600 font-medium">No owner set</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => { setStatusOrg(org); setNewStatus(org.status); }}
                      title="Click to change status"
                    >
                      <Badge tone={STATUS_TONE[org.status] ?? "neutral"}>{org.status}</Badge>
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setOwnerOrg(org);
                          setOwnerForm({ ownerName: "", ownerEmail: "", ownerPassword: "" });
                          setOwnerError(null);
                          setShowOwnerPassword(false);
                        }}
                      >
                        {org.ownerName ? "Replace Owner" : "Set Owner"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(org)}>Edit</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── Add / Edit modal ──────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        title={editingId ? "Edit Organization" : "Add Organization"}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Organization Details</p>

          <Field label="Organization Name *">
            <Input required value={form.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Hayat Clinic" />
          </Field>

          <Field label="Slug *">
            <Input
              required value={form.slug}
              onChange={(e) => setField("slug", e.target.value)}
              placeholder="e.g. hayat-clinic"
              pattern="^[a-z0-9-]+$"
              title="Lowercase letters, digits and hyphens only"
            />
            <span className="text-xs text-black/40 mt-0.5">Auto-generated. Lowercase letters, digits, hyphens only.</span>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Vertical *">
              <Select required value={form.vertical} onChange={(e) => setField("vertical", e.target.value)}>
                {VERTICALS.map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
              </Select>
            </Field>
            <Field label="Timezone *">
              <Select required value={form.timezone} onChange={(e) => setField("timezone", e.target.value)}>
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Logo URL (optional)">
            <Input type="url" value={form.logoUrl ?? ""} onChange={(e) => setField("logoUrl", e.target.value)} placeholder="https://example.com/logo.png" />
          </Field>

          <Field label="Primary Color (optional)">
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={form.primaryColor || "#0a4f3f"}
                onChange={(e) => setField("primaryColor", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-black/15 p-0.5"
              />
              <Input value={form.primaryColor ?? ""} onChange={(e) => setField("primaryColor", e.target.value)} placeholder="#0a4f3f" className="flex-1" />
            </div>
          </Field>

          {!editingId && (
            <>
              <div className="border-t border-black/5 pt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Owner Login Account</p>
                <p className="text-xs text-black/40 mt-0.5">This person will be the Organization Owner and can log in immediately.</p>
              </div>
              <Field label="Full Name *">
                <Input required value={form.ownerName ?? ""} onChange={(e) => setField("ownerName", e.target.value)} placeholder="e.g. Dr. Ahmed Khan" />
              </Field>
              <Field label="Email Address *">
                <Input required type="email" value={form.ownerEmail ?? ""} onChange={(e) => setField("ownerEmail", e.target.value)} placeholder="e.g. ahmed@hayatclinic.org" />
              </Field>
              <Field label="Password *">
                <div className="relative">
                  <Input
                    required
                    type={showPassword ? "text" : "password"}
                    value={form.ownerPassword ?? ""}
                    onChange={(e) => setField("ownerPassword", e.target.value)}
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    className="pr-16"
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-black/40 hover:text-black">
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </Field>
            </>
          )}

          {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

          <div className="flex justify-end gap-3 pt-1 sticky bottom-0 bg-white pb-1">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editingId ? "Save Changes" : "Create Organization & Owner"}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Set Owner modal ───────────────────────────────────────────────── */}
      <Modal
        open={!!ownerOrg}
        title={ownerOrg?.ownerName ? `Replace Owner — ${ownerOrg.name}` : `Set Owner — ${ownerOrg?.name}`}
        onClose={() => setOwnerOrg(null)}
      >
        {ownerOrg && (
          <form onSubmit={handleSetOwner} className="flex flex-col gap-4">
            {ownerOrg.ownerName && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Current owner: <strong>{ownerOrg.ownerName}</strong> ({ownerOrg.ownerEmail}). Setting a new owner will deactivate their access.
              </div>
            )}
            <Field label="Full Name *">
              <Input required value={ownerForm.ownerName} onChange={(e) => setOwnerForm((f) => ({ ...f, ownerName: e.target.value }))} placeholder="e.g. Dr. Ahmed Khan" />
            </Field>
            <Field label="Email Address *">
              <Input required type="email" value={ownerForm.ownerEmail} onChange={(e) => setOwnerForm((f) => ({ ...f, ownerEmail: e.target.value }))} placeholder="e.g. ahmed@hayatclinic.org" />
            </Field>
            <Field label="Password *">
              <div className="relative">
                <Input
                  required
                  type={showOwnerPassword ? "text" : "password"}
                  value={ownerForm.ownerPassword}
                  onChange={(e) => setOwnerForm((f) => ({ ...f, ownerPassword: e.target.value }))}
                  placeholder="Minimum 8 characters"
                  minLength={8}
                  className="pr-16"
                />
                <button type="button" onClick={() => setShowOwnerPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-black/40 hover:text-black">
                  {showOwnerPassword ? "Hide" : "Show"}
                </button>
              </div>
            </Field>
            {ownerError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{ownerError}</p>}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" type="button" onClick={() => setOwnerOrg(null)}>Cancel</Button>
              <Button type="submit" loading={savingOwner}>Create Owner Account</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Status change modal ───────────────────────────────────────────── */}
      <Modal open={!!statusOrg} title="Change Status" onClose={() => setStatusOrg(null)}>
        {statusOrg && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-black/60">
              Update the status for <strong>{statusOrg.name}</strong>.
            </p>
            <Field label="New Status">
              <Select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </Select>
            </Field>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setStatusOrg(null)}>Cancel</Button>
              <Button loading={savingStatus} onClick={handleStatusSave}>Save Status</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

// ─── org-wide snapshot ────────────────────────────────────────────────────────
function OrgSnapshot({ name, data }: { name: string; data: OrgDashboard }) {
  const progress =
    data.totalPledged > 0 ? Math.round((data.totalCollected / data.totalPledged) * 100) : 0;

  return (
    <>
      <p className="mb-4 text-sm text-black/50">
        Welcome back, <span className="font-semibold text-black/70">{name}</span>
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total donors" value={data.totalDonors} />
        <StatCard label="Active campaigns" value={data.totalCampaigns} />
        <StatCard label="Open follow-ups" value={data.openFollowUps} />
        <StatCard label="Total pledged" value={currency(data.totalPledged)} />
        <StatCard label="Total collected" value={currency(data.totalCollected)} />
        <StatCard label="Outstanding" value={currency(data.remaining)} hint={`${progress}% collected`} />
      </div>
      <div className="mt-6 rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <p className="mb-2 text-sm font-medium text-black/60">Collection progress</p>
        <div className="h-3 w-full overflow-hidden rounded-full bg-black/5">
          <div className="h-full rounded-full bg-emerald" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-sm text-black/50">
          {currency(data.totalCollected)} collected of {currency(data.totalPledged)} pledged
        </p>
      </div>
    </>
  );
}

// ─── ambassador personal snapshot ─────────────────────────────────────────────
function AmbassadorSnapshot({ name, data }: { name: string; data: AmbassadorDashboard }) {
  const followUpPct =
    data.totalFollowUps > 0 ? Math.round((data.completedFollowUps / data.totalFollowUps) * 100) : 0;
  const collectionPct =
    data.totalPledged > 0 ? Math.round((data.totalCollected / data.totalPledged) * 100) : 0;

  return (
    <>
      <p className="mb-4 text-sm text-black/50">
        Welcome back, <span className="font-semibold text-black/70">{name}</span>
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Assigned donors" value={data.assignedDonors} />
        <StatCard label="Open follow-ups" value={data.openFollowUps} />
        <StatCard label="Pledges recorded" value={data.pledgeCount} />
        <StatCard label="Outstanding" value={currency(data.outstanding)} hint={`${collectionPct}% collected`} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <p className="mb-1 text-sm font-medium text-black/60">Follow-up progress</p>
          <p className="mb-3 text-xs text-black/40">{data.completedFollowUps} of {data.totalFollowUps} completed</p>
          <div className="h-3 w-full overflow-hidden rounded-full bg-black/5">
            <div className="h-full rounded-full bg-emerald" style={{ width: `${followUpPct}%` }} />
          </div>
          <p className="mt-2 text-sm text-black/50">{followUpPct}% done</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <p className="mb-1 text-sm font-medium text-black/60">Pledge collection</p>
          <p className="mb-3 text-xs text-black/40">{currency(data.totalCollected)} of {currency(data.totalPledged)}</p>
          <div className="h-3 w-full overflow-hidden rounded-full bg-black/5">
            <div className="h-full rounded-full bg-emerald" style={{ width: `${collectionPct}%` }} />
          </div>
          <p className="mt-2 text-sm text-black/50">{collectionPct}% collected</p>
        </div>
      </div>
      <Section title="Upcoming Events">
        {data.upcomingEvents.length === 0 ? <Empty text="No upcoming events." /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-slate-500">
              <th className="py-2 pr-4">Event</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Location</th>
              <th className="py-2">Date</th>
            </tr></thead>
            <tbody>
              {data.upcomingEvents.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{e.name}</td>
                  <td className="py-2 pr-4 capitalize text-slate-500">{e.eventType}</td>
                  <td className="py-2 pr-4 text-slate-500">{e.location ?? "—"}</td>
                  <td className="py-2 text-slate-500">{fmt(e.startsAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      <Section title="Upcoming Townhalls">
        {data.upcomingTownhalls.length === 0 ? <Empty text="No upcoming townhalls." /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-slate-500">
              <th className="py-2 pr-4">Person</th>
              <th className="py-2 pr-4">Address</th>
              <th className="py-2 pr-4">Date</th>
              <th className="py-2">Time</th>
            </tr></thead>
            <tbody>
              {data.upcomingTownhalls.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{t.personName}</td>
                  <td className="py-2 pr-4 text-slate-500">{t.address ?? "—"}</td>
                  <td className="py-2 pr-4 text-slate-500">{fmt(t.eventDate)}</td>
                  <td className="py-2 text-slate-500">{fmtTime(t.eventTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      <Section title="Active Campaigns">
        {data.activeCampaigns.length === 0 ? <Empty text="No active campaigns." /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-slate-500">
              <th className="py-2 pr-4">Campaign</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Goal</th>
              <th className="py-2">Ends</th>
            </tr></thead>
            <tbody>
              {data.activeCampaigns.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{c.name}</td>
                  <td className="py-2 pr-4 capitalize text-slate-500">{c.campaignType}</td>
                  <td className="py-2 pr-4 text-slate-500">{currency(c.goalAmount)}</td>
                  <td className="py-2 text-slate-500">{fmt(c.endDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mt-4 p-0">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold text-black/70">{title}</p>
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-slate-400">{text}</p>;
}

// ─── campaign manager snapshot ────────────────────────────────────────────────
function CampaignManagerSnapshot({ name, data }: { name: string; data: CampaignManagerDashboard }) {
  const collectionPct =
    data.totalPledged > 0 ? Math.round((data.totalCollected / data.totalPledged) * 100) : 0;

  return (
    <>
      <p className="mb-4 text-sm text-black/50">
        Welcome back, <span className="font-semibold text-black/70">{name}</span>
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My campaigns" value={data.totalManagedCampaigns} />
        <StatCard label="My ambassadors" value={data.myAmbassadors.length} />
        <StatCard label="Open follow-ups" value={data.openFollowUps} />
        <StatCard label="Outstanding" value={currency(data.outstanding)} hint={`${collectionPct}% collected`} />
      </div>
      <div className="mt-4 rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <p className="mb-1 text-sm font-medium text-black/60">Pledge collection across my campaigns</p>
        <p className="mb-3 text-xs text-black/40">{currency(data.totalCollected)} of {currency(data.totalPledged)}</p>
        <div className="h-3 w-full overflow-hidden rounded-full bg-black/5">
          <div className="h-full rounded-full bg-emerald" style={{ width: `${collectionPct}%` }} />
        </div>
        <p className="mt-2 text-sm text-black/50">{collectionPct}% collected</p>
      </div>
      <Section title="My Campaigns">
        {data.managedCampaigns.length === 0 ? <Empty text="No campaigns assigned to you yet." /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-slate-500">
              <th className="py-2 pr-4">Campaign</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Goal</th>
              <th className="py-2 pr-4">Pledged</th>
              <th className="py-2">Ends</th>
            </tr></thead>
            <tbody>
              {data.managedCampaigns.map((c) => {
                const pct = c.goalAmount > 0 ? Math.round((c.collected / c.goalAmount) * 100) : 0;
                return (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{c.name}</td>
                    <td className="py-2 pr-4 capitalize text-slate-500">{c.status}</td>
                    <td className="py-2 pr-4 text-slate-500">{currency(c.goalAmount)}</td>
                    <td className="py-2 pr-4">{currency(c.pledged)}<span className="ml-1 text-xs text-slate-400">({pct}%)</span></td>
                    <td className="py-2 text-slate-500">{fmt(c.endDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>
      <Section title="My Ambassadors">
        {data.myAmbassadors.length === 0 ? <Empty text="No ambassadors created by you yet." /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-slate-500">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2">Status</th>
            </tr></thead>
            <tbody>
              {data.myAmbassadors.map((a) => (
                <tr key={a.userId} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{a.fullName}</td>
                  <td className="py-2 pr-4 text-slate-500">{a.email}</td>
                  <td className="py-2 capitalize text-slate-500">{a.memberStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}

// ─── page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { session, hasPermission } = useAuth();
  const isPlatformAdmin = session?.platformAdmin === true;
  const canViewReports = hasPermission("reports.view");
  const isCampaignManager = session?.roleCode === "campaign_manager";

  const [orgData, setOrgData] = useState<OrgDashboard | null>(null);
  const [myData, setMyData] = useState<AmbassadorDashboard | null>(null);
  const [cmData, setCmData] = useState<CampaignManagerDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPlatformAdmin) return; // platform admin loads its own data
    if (canViewReports && !isCampaignManager) {
      api.get<OrgDashboard>("/dashboard").then(setOrgData).catch((e) => setError(e.message));
    } else if (isCampaignManager) {
      api.get<CampaignManagerDashboard>("/dashboard/campaign-manager").then(setCmData).catch((e) => setError(e.message));
    } else {
      api.get<AmbassadorDashboard>("/dashboard/my").then(setMyData).catch((e) => setError(e.message));
    }
  }, [isPlatformAdmin, canViewReports, isCampaignManager]);

  const roleName = session?.roleCode ? (ROLE_LABELS[session.roleCode] ?? session.roleCode) : "";

  if (!isPlatformAdmin && error) return <p className="text-red-600 p-4">{error}</p>;
  if (!isPlatformAdmin && canViewReports && !isCampaignManager && !orgData) return <Spinner />;
  if (!isPlatformAdmin && isCampaignManager && !cmData) return <Spinner />;
  if (!isPlatformAdmin && !canViewReports && !isCampaignManager && !myData) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={
          isPlatformAdmin
            ? "Platform Super Admin"
            : `${roleName} — ${session?.organizationName ?? ""}`
        }
      />

      {isPlatformAdmin && (
        <PlatformAdminDashboard name={session?.fullName ?? ""} />
      )}

      {!isPlatformAdmin && canViewReports && !isCampaignManager && orgData && (
        <OrgSnapshot name={session?.fullName ?? ""} data={orgData} />
      )}

      {!isPlatformAdmin && isCampaignManager && cmData && (
        <CampaignManagerSnapshot name={session?.fullName ?? ""} data={cmData} />
      )}

      {!isPlatformAdmin && !canViewReports && !isCampaignManager && myData && (
        <AmbassadorSnapshot name={session?.fullName ?? ""} data={myData} />
      )}
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  organization_owner: "Organization Owner",
  organization_admin: "Organization Admin",
  campaign_manager: "Campaign Manager",
  finance_user: "Finance User",
  ambassador: "Ambassador",
  volunteer: "Volunteer",
  donor: "Donor",
  platform_super_admin: "Platform Super Admin",
};

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

function fmtTime(t: string | null | undefined) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m));
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/* ─── org-wide snapshot ────────────────────────────────────────── */
function OrgSnapshot({ name, data }: { name: string; data: OrgDashboard }) {
  const progress =
    data.totalPledged > 0
      ? Math.round((data.totalCollected / data.totalPledged) * 100)
      : 0;

  return (
    <>
      <p className="mb-4 text-sm text-black/50">
        Welcome back, <span className="font-semibold text-black/70">{name}</span>
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total donors" value={data.totalDonors} />
        <StatCard label="Active campaigns" value={data.totalCampaigns} />
        <StatCard label="Open follow-ups" value={data.openFollowUps} />
        <StatCard label="Total pledged" value={currency(data.totalPledged)} />
        <StatCard label="Total collected" value={currency(data.totalCollected)} />
        <StatCard label="Outstanding" value={currency(data.remaining)} hint={`${progress}% collected`} />
      </div>

      <div className="mt-6 rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <p className="mb-2 text-sm font-medium text-black/60">Collection progress</p>
        <div className="h-3 w-full overflow-hidden rounded-full bg-black/5">
          <div className="h-full rounded-full bg-emerald" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-sm text-black/50">
          {currency(data.totalCollected)} collected of {currency(data.totalPledged)} pledged
        </p>
      </div>
    </>
  );
}

/* ─── ambassador personal snapshot ────────────────────────────── */
function AmbassadorSnapshot({ name, data }: { name: string; data: AmbassadorDashboard }) {
  const followUpPct =
    data.totalFollowUps > 0
      ? Math.round((data.completedFollowUps / data.totalFollowUps) * 100)
      : 0;

  const collectionPct =
    data.totalPledged > 0
      ? Math.round((data.totalCollected / data.totalPledged) * 100)
      : 0;

  return (
    <>
      <p className="mb-4 text-sm text-black/50">
        Welcome back, <span className="font-semibold text-black/70">{name}</span>
      </p>

      {/* work counters */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Assigned donors" value={data.assignedDonors} />
        <StatCard label="Open follow-ups" value={data.openFollowUps} />
        <StatCard label="Pledges recorded" value={data.pledgeCount} />
        <StatCard label="Outstanding" value={currency(data.outstanding)} hint={`${collectionPct}% collected`} />
      </div>

      {/* progress bars */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <p className="mb-1 text-sm font-medium text-black/60">Follow-up progress</p>
          <p className="mb-3 text-xs text-black/40">{data.completedFollowUps} of {data.totalFollowUps} completed</p>
          <div className="h-3 w-full overflow-hidden rounded-full bg-black/5">
            <div className="h-full rounded-full bg-emerald" style={{ width: `${followUpPct}%` }} />
          </div>
          <p className="mt-2 text-sm text-black/50">{followUpPct}% done</p>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <p className="mb-1 text-sm font-medium text-black/60">Pledge collection</p>
          <p className="mb-3 text-xs text-black/40">{currency(data.totalCollected)} of {currency(data.totalPledged)}</p>
          <div className="h-3 w-full overflow-hidden rounded-full bg-black/5">
            <div className="h-full rounded-full bg-emerald" style={{ width: `${collectionPct}%` }} />
          </div>
          <p className="mt-2 text-sm text-black/50">{collectionPct}% collected</p>
        </div>
      </div>

      {/* upcoming events */}
      <Section title="Upcoming Events">
        {data.upcomingEvents.length === 0 ? (
          <Empty text="No upcoming events." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-4">Event</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Location</th>
                <th className="py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.upcomingEvents.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{e.name}</td>
                  <td className="py-2 pr-4 capitalize text-slate-500">{e.eventType}</td>
                  <td className="py-2 pr-4 text-slate-500">{e.location ?? "—"}</td>
                  <td className="py-2 text-slate-500">{fmt(e.startsAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* upcoming townhalls */}
      <Section title="Upcoming Townhalls">
        {data.upcomingTownhalls.length === 0 ? (
          <Empty text="No upcoming townhalls." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-4">Person</th>
                <th className="py-2 pr-4">Address</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {data.upcomingTownhalls.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{t.personName}</td>
                  <td className="py-2 pr-4 text-slate-500">{t.address ?? "—"}</td>
                  <td className="py-2 pr-4 text-slate-500">{fmt(t.eventDate)}</td>
                  <td className="py-2 text-slate-500">{fmtTime(t.eventTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* active campaigns */}
      <Section title="Active Campaigns">
        {data.activeCampaigns.length === 0 ? (
          <Empty text="No active campaigns." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-4">Campaign</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Goal</th>
                <th className="py-2">Ends</th>
              </tr>
            </thead>
            <tbody>
              {data.activeCampaigns.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{c.name}</td>
                  <td className="py-2 pr-4 capitalize text-slate-500">{c.campaignType}</td>
                  <td className="py-2 pr-4 text-slate-500">{currency(c.goalAmount)}</td>
                  <td className="py-2 text-slate-500">{fmt(c.endDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mt-4 p-0">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold text-black/70">{title}</p>
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-slate-400">{text}</p>;
}

/* ─── campaign manager snapshot ───────────────────────────── */
function CampaignManagerSnapshot({ name, data }: { name: string; data: CampaignManagerDashboard }) {
  const collectionPct =
    data.totalPledged > 0 ? Math.round((data.totalCollected / data.totalPledged) * 100) : 0;

  return (
    <>
      <p className="mb-4 text-sm text-black/50">
        Welcome back, <span className="font-semibold text-black/70">{name}</span>
      </p>

      {/* counters */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My campaigns" value={data.totalManagedCampaigns} />
        <StatCard label="My ambassadors" value={data.myAmbassadors.length} />
        <StatCard label="Open follow-ups" value={data.openFollowUps} />
        <StatCard label="Outstanding" value={currency(data.outstanding)} hint={`${collectionPct}% collected`} />
      </div>

      {/* collection progress */}
      <div className="mt-4 rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <p className="mb-1 text-sm font-medium text-black/60">Pledge collection across my campaigns</p>
        <p className="mb-3 text-xs text-black/40">{currency(data.totalCollected)} of {currency(data.totalPledged)}</p>
        <div className="h-3 w-full overflow-hidden rounded-full bg-black/5">
          <div className="h-full rounded-full bg-emerald" style={{ width: `${collectionPct}%` }} />
        </div>
        <p className="mt-2 text-sm text-black/50">{collectionPct}% collected</p>
      </div>

      {/* my campaigns table */}
      <Section title="My Campaigns">
        {data.managedCampaigns.length === 0 ? (
          <Empty text="No campaigns assigned to you yet." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-4">Campaign</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Goal</th>
                <th className="py-2 pr-4">Pledged</th>
                <th className="py-2">Ends</th>
              </tr>
            </thead>
            <tbody>
              {data.managedCampaigns.map((c) => {
                const pct = c.goalAmount > 0 ? Math.round((c.collected / c.goalAmount) * 100) : 0;
                return (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{c.name}</td>
                    <td className="py-2 pr-4 capitalize text-slate-500">{c.status}</td>
                    <td className="py-2 pr-4 text-slate-500">{currency(c.goalAmount)}</td>
                    <td className="py-2 pr-4">
                      {currency(c.pledged)}
                      <span className="ml-1 text-xs text-slate-400">({pct}%)</span>
                    </td>
                    <td className="py-2 text-slate-500">{fmt(c.endDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* my ambassadors */}
      <Section title="My Ambassadors">
        {data.myAmbassadors.length === 0 ? (
          <Empty text="No ambassadors created by you yet." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.myAmbassadors.map((a) => (
                <tr key={a.userId} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{a.fullName}</td>
                  <td className="py-2 pr-4 text-slate-500">{a.email}</td>
                  <td className="py-2 capitalize text-slate-500">{a.memberStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}



