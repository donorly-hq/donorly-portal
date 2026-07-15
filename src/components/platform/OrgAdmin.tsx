"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { BRAND } from "@/lib/color";
import type { Organization, OrganizationRequest, OrgMemberSummary } from "@/lib/types";
import { Badge, Button, Field, Input, Modal, Select } from "@/components/ui";

/**
 * Shared platform-admin organization CRUD: the add/edit, owner-transfer, and
 * status modals plus all their state/handlers. Used by both the platform-admin
 * dashboard and the /platform/organizations page — previously ~600 duplicated
 * lines between the two.
 */

// ─── shared constants ─────────────────────────────────────────────────────────

export const VERTICALS = [
  "nonprofit", "mosque", "church", "synagogue",
  "temple", "charity", "clinic", "other",
];

export const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Phoenix", "America/Anchorage",
  "Pacific/Honolulu", "Europe/London", "Europe/Paris",
  "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata",
  "Asia/Dhaka", "Asia/Singapore", "Australia/Sydney",
];

export const STATUSES = ["trial", "active", "suspended", "cancelled"];

export const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  active: "success", trial: "warning", suspended: "danger", cancelled: "neutral",
};

const EMPTY_FORM: OrganizationRequest = {
  name: "", slug: "", vertical: "nonprofit", timezone: "America/Chicago",
  logoUrl: "", logoData: undefined, primaryColor: BRAND.emerald,
  ownerName: "", ownerEmail: "", ownerPassword: "",
};

export function slugify(name: string) {
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

// ─── hook: state + handlers ───────────────────────────────────────────────────

export function useOrgAdmin() {
  const { session, refreshBranding } = useAuth();
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
      logoData: undefined,
      primaryColor: org.primaryColor ?? BRAND.emerald,
    });
    setFormError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setModalOpen(true);
  }

  function openStatus(org: Organization) {
    setStatusOrg(org);
    setNewStatus(org.status);
  }

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

  function setField<K extends keyof OrganizationRequest>(key: K, value: OrganizationRequest[K]) {
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
      setField("logoData", data);
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
        if (editingId === session?.organizationId) {
          await refreshBranding();
        }
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
      const updated = await api.put<Organization>(`/organizations/${ownerOrg.id}/owner`, payload);
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

  return {
    orgs, loading, error,
    openAdd, openEdit, openStatus, openOwnerModal,
    modals: {
      modalOpen, setModalOpen, editingId, form, showPassword, setShowPassword,
      saving, formError, compressing, fileInputRef,
      statusOrg, setStatusOrg, newStatus, setNewStatus, savingStatus,
      ownerOrg, setOwnerOrg, ownerMode, setOwnerMode, orgMembers, loadingMembers,
      promoteUserId, setPromoteUserId, ownerForm, setOwnerForm,
      showOwnerPassword, setShowOwnerPassword, savingOwner, ownerError,
      setField, handleNameChange, handleLogoUpload, handleSubmit,
      handleSetOwner, handlePromoteOwner, handleStatusSave,
    },
  };
}

export type OrgAdmin = ReturnType<typeof useOrgAdmin>;

// ─── shared table cells ───────────────────────────────────────────────────────

export function OrgOwnerCell({ org }: { org: Organization }) {
  return org.ownerName ? (
    <>
      <p className="font-medium">{org.ownerName}</p>
      <p className="text-xs text-black/40">{org.ownerEmail}</p>
    </>
  ) : (
    <span className="text-xs text-amber-600 font-medium">No owner set</span>
  );
}

export function OrgStatusBadge({ org, onClick }: { org: Organization; onClick: () => void }) {
  return (
    <button onClick={onClick} title="Click to change status">
      <Badge tone={STATUS_TONE[org.status] ?? "neutral"}>{org.status}</Badge>
    </button>
  );
}

export function OrgRowActions({
  org,
  admin,
}: {
  org: Organization;
  admin: OrgAdmin;
}) {
  return (
    <div className="flex gap-2 justify-end">
      <Button variant="ghost" size="sm" onClick={() => admin.openOwnerModal(org)}>
        {org.ownerName ? "Transfer Owner" : "Set Owner"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => admin.openEdit(org)}>Edit</Button>
    </div>
  );
}

// ─── modals ───────────────────────────────────────────────────────────────────

export function OrgAdminModals({ admin }: { admin: OrgAdmin }) {
  const m = admin.modals;
  const editingOrg = m.editingId ? admin.orgs.find((o) => o.id === m.editingId) : undefined;

  return (
    <>
      {/* ── Add / Edit modal ─────────────────────────────────────────────────── */}
      <Modal
        open={m.modalOpen}
        title={m.editingId ? "Edit Organization" : "Add Organization"}
        onClose={() => m.setModalOpen(false)}
      >
        <form onSubmit={m.handleSubmit} className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Organization Details</p>

          <Field label="Organization Name *">
            <Input required value={m.form.name} onChange={(e) => m.handleNameChange(e.target.value)} placeholder="e.g. Hayat Clinic" />
          </Field>

          <Field label="Slug *">
            <Input
              required value={m.form.slug}
              onChange={(e) => m.setField("slug", e.target.value)}
              placeholder="e.g. hayat-clinic"
              pattern="^[a-z0-9-]+$"
              title="Lowercase letters, digits and hyphens only"
            />
            <span className="text-xs text-black/40 mt-0.5">Auto-generated. Lowercase letters, digits, hyphens only.</span>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Vertical *">
              <Select required value={m.form.vertical} onChange={(e) => m.setField("vertical", e.target.value)}>
                {VERTICALS.map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
              </Select>
            </Field>
            <Field label="Timezone *">
              <Select required value={m.form.timezone} onChange={(e) => m.setField("timezone", e.target.value)}>
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Logo / Watermark Image (optional)">
            <div className="space-y-2">
              {(m.form.logoData || (m.editingId && editingOrg?.hasLogo)) && (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.form.logoData ?? `/api/organizations/${m.editingId}/logo`}
                    alt="Logo preview"
                    className="h-14 w-14 rounded object-contain border border-black/10 bg-black/5 p-1"
                  />
                  {m.form.logoData && (
                    <button
                      type="button"
                      className="text-xs text-red-500 hover:underline"
                      onClick={() => { m.setField("logoData", undefined); if (m.fileInputRef.current) m.fileInputRef.current.value = ""; }}
                    >
                      Clear new upload
                    </button>
                  )}
                </div>
              )}
              <input
                ref={m.fileInputRef}
                type="file"
                accept="image/*"
                onChange={m.handleLogoUpload}
                disabled={m.compressing}
                className="block w-full text-sm text-black/60 file:mr-3 file:rounded file:border-0 file:bg-black/5 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-black/10 cursor-pointer"
              />
              {m.compressing && <p className="text-xs text-black/40">Compressing…</p>}
              <p className="text-xs text-black/40">
                PNG, JPG or SVG · max 5 MB · auto-compressed · used as sidebar logo &amp; background watermark
              </p>
            </div>
          </Field>

          <Field label="Logo URL (optional)">
            <Input type="url" value={m.form.logoUrl ?? ""} onChange={(e) => m.setField("logoUrl", e.target.value)} placeholder="https://example.com/logo.png" />
            <p className="text-xs text-black/40 mt-1">Used as fallback when no image is uploaded above.</p>
          </Field>

          <Field label="Primary Color (optional)">
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={m.form.primaryColor || BRAND.emerald}
                onChange={(e) => m.setField("primaryColor", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-black/15 p-0.5"
              />
              <Input value={m.form.primaryColor || ""} onChange={(e) => m.setField("primaryColor", e.target.value)} placeholder={BRAND.emerald} className="flex-1" />
            </div>
          </Field>

          {!m.editingId && (
            <>
              <div className="border-t border-black/5 pt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Owner Login Account</p>
                <p className="text-xs text-black/40 mt-0.5">This person will be the Organization Owner and can log in immediately.</p>
              </div>
              <Field label="Full Name *">
                <Input required value={m.form.ownerName ?? ""} onChange={(e) => m.setField("ownerName", e.target.value)} placeholder="e.g. Dr. Ahmed Khan" />
              </Field>
              <Field label="Email Address *">
                <Input required type="email" value={m.form.ownerEmail ?? ""} onChange={(e) => m.setField("ownerEmail", e.target.value)} placeholder="e.g. ahmed@hayatclinic.org" />
              </Field>
              <Field label="Password *">
                <div className="relative">
                  <Input
                    required
                    type={m.showPassword ? "text" : "password"}
                    value={m.form.ownerPassword ?? ""}
                    onChange={(e) => m.setField("ownerPassword", e.target.value)}
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    className="pr-16"
                  />
                  <button type="button" onClick={() => m.setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-black/40 hover:text-black">
                    {m.showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </Field>
            </>
          )}

          {m.formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{m.formError}</p>}

          <div className="flex justify-end gap-3 pt-1 sticky bottom-0 bg-white pb-1">
            <Button variant="secondary" type="button" onClick={() => m.setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={m.saving}>{m.editingId ? "Save Changes" : "Create Organization & Owner"}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Set Owner modal ───────────────────────────────────────────────── */}
      <Modal
        open={!!m.ownerOrg}
        title={m.ownerOrg?.ownerName ? `Transfer Owner — ${m.ownerOrg.name}` : `Set Owner — ${m.ownerOrg?.name}`}
        onClose={() => m.setOwnerOrg(null)}
      >
        {m.ownerOrg && (
          <div className="flex flex-col gap-4">
            {m.ownerOrg.ownerName && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Current owner: <strong>{m.ownerOrg.ownerName}</strong> ({m.ownerOrg.ownerEmail}).
                They will be demoted to <strong>Organization Admin</strong> and keep access.
              </div>
            )}

            <div className="flex gap-2 border-b border-black/10 pb-2">
              <button
                type="button"
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${m.ownerMode === "promote" ? "bg-emerald-100 text-emerald" : "text-black/50 hover:bg-emerald-50"}`}
                onClick={() => m.setOwnerMode("promote")}
              >
                Promote member
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${m.ownerMode === "new" ? "bg-emerald-100 text-emerald" : "text-black/50 hover:bg-emerald-50"}`}
                onClick={() => m.setOwnerMode("new")}
              >
                New account
              </button>
            </div>

            {m.ownerMode === "promote" ? (
              <form onSubmit={m.handlePromoteOwner} className="flex flex-col gap-4">
                <Field label="Select team member *">
                  {m.loadingMembers ? (
                    <p className="text-sm text-black/40">Loading members…</p>
                  ) : m.orgMembers.length === 0 ? (
                    <p className="text-sm text-black/40">No active members yet. Use &quot;New account&quot; to create an owner.</p>
                  ) : (
                    <Select required value={m.promoteUserId} onChange={(e) => m.setPromoteUserId(e.target.value)}>
                      {m.orgMembers.map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {member.fullName} ({member.email}) — {member.roleName ?? member.roleCode}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                {m.ownerError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{m.ownerError}</p>}
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" type="button" onClick={() => m.setOwnerOrg(null)}>Cancel</Button>
                  <Button type="submit" loading={m.savingOwner} disabled={!m.promoteUserId || m.orgMembers.length === 0}>
                    Promote to Owner
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={m.handleSetOwner} className="flex flex-col gap-4">
                <p className="text-xs text-black/40">
                  Creates a new login or links an existing Donorly account by email. Password is only required for new accounts.
                </p>
                <Field label="Full Name *">
                  <Input required value={m.ownerForm.ownerName} onChange={(e) => m.setOwnerForm((f) => ({ ...f, ownerName: e.target.value }))} placeholder="e.g. Dr. Ahmed Khan" />
                </Field>
                <Field label="Email Address *">
                  <Input required type="email" value={m.ownerForm.ownerEmail} onChange={(e) => m.setOwnerForm((f) => ({ ...f, ownerEmail: e.target.value }))} placeholder="e.g. ahmed@hayatclinic.org" />
                </Field>
                <Field label="Password (new accounts only)">
                  <div className="relative">
                    <Input
                      type={m.showOwnerPassword ? "text" : "password"}
                      value={m.ownerForm.ownerPassword}
                      onChange={(e) => m.setOwnerForm((f) => ({ ...f, ownerPassword: e.target.value }))}
                      placeholder="Minimum 8 characters"
                      minLength={8}
                      className="pr-16"
                    />
                    <button type="button" onClick={() => m.setShowOwnerPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-black/40 hover:text-black">
                      {m.showOwnerPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </Field>
                {m.ownerError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{m.ownerError}</p>}
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" type="button" onClick={() => m.setOwnerOrg(null)}>Cancel</Button>
                  <Button type="submit" loading={m.savingOwner}>Assign Owner</Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>

      {/* ── Status change modal ───────────────────────────────────────────── */}
      <Modal open={!!m.statusOrg} title="Change Status" onClose={() => m.setStatusOrg(null)}>
        {m.statusOrg && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-black/60">
              Update the status for <strong>{m.statusOrg.name}</strong>.
            </p>
            <Field label="New Status">
              <Select value={m.newStatus} onChange={(e) => m.setNewStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </Select>
            </Field>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => m.setStatusOrg(null)}>Cancel</Button>
              <Button loading={m.savingStatus} onClick={m.handleStatusSave}>Save Status</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
