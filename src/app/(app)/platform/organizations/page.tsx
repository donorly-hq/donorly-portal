"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Organization, OrganizationRequest, OrgMemberSummary } from "@/lib/types";
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
} from "@/components/ui";

// ─── constants ───────────────────────────────────────────────────────────────

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

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  trial: "warning",
  suspended: "danger",
  cancelled: "neutral",
};

const STATUSES = ["trial", "active", "suspended", "cancelled"];

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Compress a File to a JPEG data URL (max 600 px, 70 % quality). */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 600;
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

const EMPTY_FORM: OrganizationRequest = {
  name: "", slug: "", vertical: "nonprofit", timezone: "America/Chicago",
  logoUrl: "", logoData: undefined, primaryColor: "#0a4f3f",
  ownerName: "", ownerEmail: "", ownerPassword: "",
};

// ─── page ─────────────────────────────────────────────────────────────────────

export default function PlatformOrganizationsPage() {
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
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // status modal
  const [statusOrg, setStatusOrg] = useState<Organization | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  // set owner modal
  const [ownerOrg, setOwnerOrg] = useState<Organization | null>(null);
  const [ownerMode, setOwnerMode] = useState<"promote" | "new">("promote");
  const [orgMembers, setOrgMembers] = useState<OrgMemberSummary[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [promoteUserId, setPromoteUserId] = useState("");
  const [ownerForm, setOwnerForm] = useState({ ownerName: "", ownerEmail: "", ownerPassword: "" });
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);
  const [savingOwner, setSavingOwner] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);

  function openOwnerModal(org: Organization) {
    setOwnerOrg(org);
    setOwnerMode("promote");
    setOwnerForm({ ownerName: "", ownerEmail: "", ownerPassword: "" });
    setPromoteUserId("");
    setOwnerError(null);
    setShowOwnerPassword(false);
    setLoadingMembers(true);
    api.get<OrgMemberSummary[]>(`/organizations/${org.id}/members`)
      .then((members) => {
        setOrgMembers(members);
        const firstNonOwner = members.find((m) => m.roleCode !== "organization_owner");
        setPromoteUserId(firstNonOwner?.userId ?? members[0]?.userId ?? "");
      })
      .catch((e) => setOwnerError(e.message))
      .finally(() => setLoadingMembers(false));
  }

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
    if (fileInputRef.current) fileInputRef.current.value = "";
    setModalOpen(true);
  }

  function openEdit(org: Organization) {
    setEditingId(org.id);
    setForm({
      name: org.name, slug: org.slug, vertical: org.vertical,
      timezone: org.timezone, logoUrl: org.logoUrl ?? "",
      logoData: org.logoData ?? undefined,
      primaryColor: org.primaryColor ?? "#0a4f3f",
    });
    setFormError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setModalOpen(true);
  }

  function set<K extends keyof OrganizationRequest>(key: K, value: OrganizationRequest[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleNameChange(name: string) {
    setForm((f) => ({ ...f, name, slug: editingId ? f.slug : slugify(name) }));
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setFormError("Image must be smaller than 5 MB");
      return;
    }
    setCompressing(true);
    try {
      const data = await compressImage(file);
      set("logoData", data);
    } catch {
      setFormError("Could not process image. Please try a different file.");
    } finally {
      setCompressing(false);
    }
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
      // strip owner fields on update
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
      const payload = {
        ownerName: ownerForm.ownerName,
        ownerEmail: ownerForm.ownerEmail,
        ownerPassword: ownerForm.ownerPassword || undefined,
      };
      const updated = await api.put<Organization>(
        `/organizations/${ownerOrg.id}/owner`,
        payload,
      );
      setOrgs((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setOwnerOrg(null);
    } catch (e: unknown) {
      setOwnerError(e instanceof Error ? e.message : "Failed to set owner");
    } finally {
      setSavingOwner(false);
    }
  }

  async function handlePromoteOwner(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerOrg || !promoteUserId) return;
    setSavingOwner(true);
    setOwnerError(null);
    try {
      const updated = await api.put<Organization>(
        `/organizations/${ownerOrg.id}/owner/${promoteUserId}`,
        {},
      );
      setOrgs((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setOwnerOrg(null);
    } catch (e: unknown) {
      setOwnerError(e instanceof Error ? e.message : "Failed to promote owner");
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

  if (loading) return <Spinner />;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <>
      <PageHeader
        title="Organizations"
        subtitle="All tenant organizations on this platform"
        action={<Button onClick={openAdd}>+ Add Organization</Button>}
      />

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
                <tr
                  key={org.id}
                  className="border-b border-black/5 last:border-0 hover:bg-black/[.02] transition"
                >
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
                      <span className="text-xs text-black/30 italic">No owner yet</span>
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
                  <td className="px-5 py-3 text-right flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openOwnerModal(org)}
                    >
                      {org.ownerName ? "Transfer Owner" : "Set Owner"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(org)}>Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── Add / Edit modal ─────────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        title={editingId ? "Edit Organization" : "Add Organization"}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">

          {/* ── Organization details ── */}
          <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
            Organization Details
          </p>

          <Field label="Organization Name *">
            <Input
              required
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Hayat Clinic"
            />
          </Field>

          <Field label="Slug *">
            <Input
              required
              value={form.slug}
              onChange={(e) => set("slug", e.target.value)}
              placeholder="e.g. hayat-clinic"
              pattern="^[a-z0-9-]+$"
              title="Lowercase letters, digits and hyphens only"
            />
            <span className="text-xs text-black/40 mt-0.5">Auto-generated from name. Lowercase letters, digits and hyphens only.</span>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Vertical *">
              <Select required value={form.vertical} onChange={(e) => set("vertical", e.target.value)}>
                {VERTICALS.map((v) => (
                  <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Timezone *">
              <Select required value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Logo / Watermark Image (optional)">
            <div className="space-y-2">
              {/* Uploaded image preview */}
              {form.logoData && (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.logoData} alt="Logo preview" className="h-14 w-14 rounded object-contain border border-black/10 bg-black/5 p-1" />
                  <button
                    type="button"
                    className="text-xs text-red-500 hover:underline"
                    onClick={() => { set("logoData", undefined); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  >
                    Remove uploaded image
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={compressing}
                className="block w-full text-sm text-black/60 file:mr-3 file:rounded file:border-0 file:bg-black/5 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-black/10 cursor-pointer"
              />
              {compressing && <p className="text-xs text-black/40">Compressing…</p>}
              <p className="text-xs text-black/40">
                PNG, JPG or SVG · max 5 MB · auto-compressed · used as sidebar logo &amp; background watermark
              </p>
            </div>
          </Field>

          <Field label="Logo URL (optional)">
            <Input
              type="url"
              value={form.logoUrl ?? ""}
              onChange={(e) => set("logoUrl", e.target.value)}
              placeholder="https://example.com/logo.png"
            />
            <p className="text-xs text-black/40 mt-1">Used as fallback when no image is uploaded above.</p>
          </Field>

          <Field label="Primary Color (optional)">
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={form.primaryColor || "#0a4f3f"}
                onChange={(e) => set("primaryColor", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-black/15 p-0.5"
              />
              <Input
                value={form.primaryColor || ""}
                onChange={(e) => set("primaryColor", e.target.value)}
                placeholder="#0a4f3f"
                className="flex-1"
              />
            </div>
          </Field>

          {/* ── Owner account (create only) ── */}
          {!editingId && (
            <>
              <div className="border-t border-black/5 pt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
                  Owner Login Account
                </p>
                <p className="text-xs text-black/40 mt-0.5">
                  This person will be the Organization Owner and can log in immediately.
                </p>
              </div>

              <Field label="Full Name *">
                <Input
                  required
                  value={form.ownerName ?? ""}
                  onChange={(e) => set("ownerName", e.target.value)}
                  placeholder="e.g. Dr. Ahmed Khan"
                />
              </Field>

              <Field label="Email Address *">
                <Input
                  required
                  type="email"
                  value={form.ownerEmail ?? ""}
                  onChange={(e) => set("ownerEmail", e.target.value)}
                  placeholder="e.g. ahmed@hayatclinic.org"
                />
              </Field>

              <Field label="Password *">
                <div className="relative">
                  <Input
                    required
                    type={showPassword ? "text" : "password"}
                    value={form.ownerPassword ?? ""}
                    onChange={(e) => set("ownerPassword", e.target.value)}
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    className="pr-16"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-black/40 hover:text-black"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </Field>
            </>
          )}

          {formError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
          )}

          <div className="flex justify-end gap-3 pt-1 sticky bottom-0 bg-white pb-1">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingId ? "Save Changes" : "Create Organization & Owner"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Set Owner modal ──────────────────────────────────────────────────── */}
      <Modal
        open={!!ownerOrg}
        title={ownerOrg?.ownerName ? `Transfer Owner — ${ownerOrg.name}` : `Set Owner — ${ownerOrg?.name}`}
        onClose={() => setOwnerOrg(null)}
      >
        {ownerOrg && (
          <div className="flex flex-col gap-4">
            {ownerOrg.ownerName && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Current owner: <strong>{ownerOrg.ownerName}</strong> ({ownerOrg.ownerEmail}).
                They will be demoted to <strong>Organization Admin</strong> and keep access.
              </div>
            )}

            <div className="flex gap-2 border-b border-black/10 pb-2">
              <button
                type="button"
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${ownerMode === "promote" ? "bg-emerald/10 text-emerald" : "text-black/50 hover:bg-black/5"}`}
                onClick={() => setOwnerMode("promote")}
              >
                Promote member
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${ownerMode === "new" ? "bg-emerald/10 text-emerald" : "text-black/50 hover:bg-black/5"}`}
                onClick={() => setOwnerMode("new")}
              >
                New account
              </button>
            </div>

            {ownerMode === "promote" ? (
              <form onSubmit={handlePromoteOwner} className="flex flex-col gap-4">
                <Field label="Select team member *">
                  {loadingMembers ? (
                    <p className="text-sm text-black/40">Loading members…</p>
                  ) : orgMembers.length === 0 ? (
                    <p className="text-sm text-black/40">No active members yet. Use &quot;New account&quot; to create an owner.</p>
                  ) : (
                    <Select
                      required
                      value={promoteUserId}
                      onChange={(e) => setPromoteUserId(e.target.value)}
                    >
                      {orgMembers.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.fullName} ({m.email}) — {m.roleName ?? m.roleCode}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                {ownerError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{ownerError}</p>
                )}
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" type="button" onClick={() => setOwnerOrg(null)}>Cancel</Button>
                  <Button type="submit" loading={savingOwner} disabled={!promoteUserId || orgMembers.length === 0}>
                    Promote to Owner
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSetOwner} className="flex flex-col gap-4">
                <p className="text-xs text-black/40">
                  Creates a new login or links an existing Donorly account by email. Password is only required for new accounts.
                </p>
                <Field label="Full Name *">
                  <Input
                    required
                    value={ownerForm.ownerName}
                    onChange={(e) => setOwnerForm((f) => ({ ...f, ownerName: e.target.value }))}
                    placeholder="e.g. Dr. Ahmed Khan"
                  />
                </Field>
                <Field label="Email Address *">
                  <Input
                    required
                    type="email"
                    value={ownerForm.ownerEmail}
                    onChange={(e) => setOwnerForm((f) => ({ ...f, ownerEmail: e.target.value }))}
                    placeholder="e.g. ahmed@hayatclinic.org"
                  />
                </Field>
                <Field label="Password (new accounts only)">
                  <div className="relative">
                    <Input
                      type={showOwnerPassword ? "text" : "password"}
                      value={ownerForm.ownerPassword}
                      onChange={(e) => setOwnerForm((f) => ({ ...f, ownerPassword: e.target.value }))}
                      placeholder="Minimum 8 characters"
                      minLength={8}
                      className="pr-16"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOwnerPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-black/40 hover:text-black"
                    >
                      {showOwnerPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </Field>
                {ownerError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{ownerError}</p>
                )}
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" type="button" onClick={() => setOwnerOrg(null)}>Cancel</Button>
                  <Button type="submit" loading={savingOwner}>Assign Owner</Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>

      {/* ── Status change modal ──────────────────────────────────────────────── */}
      <Modal open={!!statusOrg} title="Change Status" onClose={() => setStatusOrg(null)}>
        {statusOrg && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-black/60">
              Update the status for <strong>{statusOrg.name}</strong>.
            </p>
            <Field label="New Status">
              <Select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
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
