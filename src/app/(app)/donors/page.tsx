"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { parseCsv } from "@/lib/csv";
import type {
  Assignment,
  Donor,
  DonorImportResult,
  DonorImportRow,
  DonorTag,
  DuplicateGroup,
  PageResponse,
  TeamMember,
} from "@/lib/types";
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
} from "@/components/ui";

const emptyForm = {
  fullName: "",
  email: "",
  phone: "",
  city: "",
  state: "",
  address: "",
  donorType: "individual",
  bucket: "confirmed",
  complianceStatus: "ok",
  assignedToUserId: "",
  majorDonor: false,
};
const PAGE_SIZE = 50;

const emptyFilters = {
  tagId: "",
  state: "",
  bucket: "",
  compliance: "",
  minAmount: "",
  maxAmount: "",
  majorOnly: false,
};

const BUCKET_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  potential: "Potential",
  re_registering: "Re-registering",
};

const COMPLIANCE_LABELS: Record<string, string> = {
  ok: "OK",
  non_compliant: "Non-compliant",
  claims_paid: "Claims paid",
  non_responsive: "Non-responsive",
};

/** Maps arbitrary CSV headers to donor fields (name/email/phone/city/state/address/type/bucket). */
function mapCsvToDonors(rows: string[][]): { donors: DonorImportRow[]; problems: string[] } {
  if (rows.length < 2) return { donors: [], problems: ["File needs a header row and at least one data row."] };
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...keys: string[]) =>
    headers.findIndex((h) => keys.some((k) => h.includes(k)));
  const nameIdx = col("name");
  const emailIdx = col("email", "e-mail");
  const phoneIdx = col("phone", "mobile", "cell");
  const cityIdx = col("city", "town");
  const stateIdx = col("state", "province");
  const addressIdx = col("address", "street");
  const typeIdx = col("type");
  const bucketIdx = col("bucket");
  if (nameIdx === -1) return { donors: [], problems: ["Could not find a name column in the header row."] };

  const donors: DonorImportRow[] = [];
  const problems: string[] = [];
  rows.slice(1).forEach((r, i) => {
    const fullName = (r[nameIdx] ?? "").trim();
    if (!fullName) {
      problems.push(`Row ${i + 2}: missing name — skipped`);
      return;
    }
    donors.push({
      fullName,
      email: emailIdx >= 0 ? (r[emailIdx] ?? "").trim() || undefined : undefined,
      phone: phoneIdx >= 0 ? (r[phoneIdx] ?? "").trim() || undefined : undefined,
      city: cityIdx >= 0 ? (r[cityIdx] ?? "").trim() || undefined : undefined,
      state: stateIdx >= 0 ? (r[stateIdx] ?? "").trim() || undefined : undefined,
      address: addressIdx >= 0 ? (r[addressIdx] ?? "").trim() || undefined : undefined,
      donorType: typeIdx >= 0 ? (r[typeIdx] ?? "").trim() || undefined : undefined,
      bucket: bucketIdx >= 0 ? (r[bucketIdx] ?? "").trim() || undefined : undefined,
    });
  });
  return { donors, problems };
}

export default function DonorsPage() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("donors.write");
  const canAssign = hasPermission("donors.assign");
  const canDelete = hasPermission("donors.delete");
  const [pageData, setPageData] = useState<PageResponse<Donor> | null>(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  // Debounced copy of `search` so we don't hit the API on every keystroke
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [tags, setTags] = useState<DonorTag[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);

  const [assignDonor, setAssignDonor] = useState<Donor | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignable, setAssignable] = useState<TeamMember[]>([]);
  const [selectedAmbassador, setSelectedAmbassador] = useState("");

  // import
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<DonorImportRow[]>([]);
  const [importProblems, setImportProblems] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<DonorImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importGroupName, setImportGroupName] = useState("");
  const [importDefaultBucket, setImportDefaultBucket] = useState("");

  // duplicates
  const [dupOpen, setDupOpen] = useState(false);
  const [dupGroups, setDupGroups] = useState<DuplicateGroup[] | null>(null);
  const [dupKeep, setDupKeep] = useState<Record<number, string>>({});
  const [merging, setMerging] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(PAGE_SIZE),
      q: query,
    });
    if (filters.tagId) params.set("tagId", filters.tagId);
    if (filters.state) params.set("state", filters.state);
    if (filters.bucket) params.set("bucket", filters.bucket);
    if (filters.compliance) params.set("compliance", filters.compliance);
    if (filters.minAmount) params.set("minAmount", filters.minAmount);
    if (filters.maxAmount) params.set("maxAmount", filters.maxAmount);
    if (filters.majorOnly) params.set("majorOnly", "true");
    api
      .get<PageResponse<Donor>>(`/donors?${params.toString()}`)
      .then(setPageData)
      .catch((e) => setError(e.message));
  }, [page, query, filters]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.get<DonorTag[]>("/donor-tags").then(setTags).catch(() => setTags([]));
    api.get<TeamMember[]>("/team/assignable").then(setMembers).catch(() => setMembers([]));
  }, []);

  const filtersActive =
    filters.tagId || filters.state || filters.bucket || filters.compliance ||
    filters.minAmount || filters.maxAmount || filters.majorOnly;

  const openAssign = async (donor: Donor) => {
    setAssignDonor(donor);
    setSelectedAmbassador("");
    try {
      const [a, members] = await Promise.all([
        api.get<Assignment[]>(`/donors/${donor.id}/assignments`),
        api.get<TeamMember[]>("/team/assignable"),
      ]);
      setAssignments(a);
      setAssignable(members);
      if (members.length) setSelectedAmbassador(members[0].userId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load assignments");
    }
  };

  const addAssignment = async () => {
    if (!assignDonor || !selectedAmbassador) return;
    await api.post(`/donors/${assignDonor.id}/assignments`, {
      ambassadorUserId: selectedAmbassador,
    });
    const a = await api.get<Assignment[]>(`/donors/${assignDonor.id}/assignments`);
    setAssignments(a);
  };

  const removeAssignment = async (assignmentId: string) => {
    if (!assignDonor) return;
    await api.delete(`/donors/${assignDonor.id}/assignments/${assignmentId}`);
    setAssignments(assignments.filter((x) => x.id !== assignmentId));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/donors", {
        ...form,
        assignedToUserId: form.assignedToUserId || undefined,
      });
      setForm(emptyForm);
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save donor");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this donor?")) return;
    await api.delete(`/donors/${id}`);
    load();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await api.download("/export/donors", "donors.csv");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const openImport = () => {
    setImportRows([]);
    setImportProblems([]);
    setImportResult(null);
    setImportGroupName("");
    setImportDefaultBucket("");
    setImportOpen(true);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const { donors: rows, problems } = mapCsvToDonors(parseCsv(text));
    setImportRows(rows);
    setImportProblems(problems);
    setImportResult(null);
  };

  const handleImportSubmit = async () => {
    if (importRows.length === 0) return;
    setImporting(true);
    try {
      const result = await api.post<DonorImportResult>("/donors/import", {
        donors: importRows.slice(0, 1000),
        groupName: importGroupName || undefined,
        defaultBucket: importDefaultBucket || undefined,
      });
      setImportResult(result);
      setImportRows([]);
      load();
    } catch (e) {
      setImportProblems([e instanceof Error ? e.message : "Import failed"]);
    } finally {
      setImporting(false);
    }
  };

  const openDuplicates = async () => {
    setDupOpen(true);
    setDupGroups(null);
    setDupKeep({});
    try {
      const groups = await api.get<DuplicateGroup[]>("/donors/duplicates");
      setDupGroups(groups);
      const initial: Record<number, string> = {};
      groups.forEach((g, i) => { initial[i] = g.donors[0]?.id ?? ""; });
      setDupKeep(initial);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load duplicates");
      setDupGroups([]);
    }
  };

  const handleMerge = async (groupIdx: number) => {
    if (!dupGroups) return;
    const group = dupGroups[groupIdx];
    const keepId = dupKeep[groupIdx];
    if (!keepId) return;
    const mergeIds = group.donors.map((d) => d.id).filter((id) => id !== keepId);
    if (mergeIds.length === 0) return;
    if (!confirm(`Merge ${mergeIds.length} duplicate record(s) into the selected donor? Their pledges, payments, and history move to the kept donor.`)) return;
    setMerging(groupIdx);
    try {
      await api.post("/donors/merge", { keepId, mergeIds });
      setDupGroups((prev) => prev ? prev.filter((_, i) => i !== groupIdx) : prev);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setMerging(null);
    }
  };

  if (error && !pageData) return <p className="text-red-600">{error}</p>;
  if (!pageData) return <Spinner />;

  const filtered = pageData.items;
  const totalItems = pageData.totalItems;

  return (
    <div>
      <PageHeader
        title="Donors"
        subtitle={`${totalItems} donor${totalItems === 1 ? "" : "s"}`}
        action={
          <div className="flex flex-wrap gap-2">
            {hasPermission("donors.export") ? (
              <Button variant="secondary" onClick={handleExport} disabled={exporting}>
                {exporting ? "Exporting..." : "Export CSV"}
              </Button>
            ) : null}
            {canWrite ? (
              <Button variant="secondary" onClick={openImport}>Import CSV</Button>
            ) : null}
            {canWrite ? (
              <Button variant="secondary" onClick={openDuplicates}>Find duplicates</Button>
            ) : null}
            {canWrite ? <Button onClick={() => setModalOpen(true)}>Add donor</Button> : null}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Input
            placeholder="Search donors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          className="w-40"
          value={filters.tagId}
          onChange={(e) => { setFilters({ ...filters, tagId: e.target.value }); setPage(0); }}
        >
          <option value="">All groups</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </Select>
        <Input
          className="w-32"
          placeholder="State"
          value={filters.state}
          onChange={(e) => { setFilters({ ...filters, state: e.target.value }); setPage(0); }}
        />
        <Select
          className="w-40"
          value={filters.bucket}
          onChange={(e) => { setFilters({ ...filters, bucket: e.target.value }); setPage(0); }}
        >
          <option value="">All buckets</option>
          <option value="confirmed">Confirmed</option>
          <option value="potential">Potential</option>
          <option value="re_registering">Re-registering</option>
        </Select>
        <Select
          className="w-44"
          value={filters.compliance}
          onChange={(e) => { setFilters({ ...filters, compliance: e.target.value }); setPage(0); }}
        >
          <option value="">Any compliance</option>
          <option value="ok">OK</option>
          <option value="non_compliant">Non-compliant</option>
          <option value="claims_paid">Claims paid</option>
          <option value="non_responsive">Non-responsive</option>
        </Select>
        <Input
          className="w-28"
          type="number"
          placeholder="Min $"
          value={filters.minAmount}
          onChange={(e) => { setFilters({ ...filters, minAmount: e.target.value }); setPage(0); }}
        />
        <Input
          className="w-28"
          type="number"
          placeholder="Max $"
          value={filters.maxAmount}
          onChange={(e) => { setFilters({ ...filters, maxAmount: e.target.value }); setPage(0); }}
        />
        <label className="flex h-9 items-center gap-2 text-sm text-black/70">
          <input
            type="checkbox"
            checked={filters.majorOnly}
            onChange={(e) => { setFilters({ ...filters, majorOnly: e.target.checked }); setPage(0); }}
            className="h-4 w-4 accent-emerald-700"
          />
          High value only
        </label>
        {filtersActive ? (
          <button
            className="text-xs text-emerald hover:underline"
            onClick={() => { setFilters(emptyFilters); setPage(0); }}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-black/50">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Bucket</th>
              <th className="px-4 py-3 font-medium">Lifetime giving</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {canWrite ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-3 font-medium text-emerald">
                  <Link href={`/donors/${d.id}`} className="hover:underline">
                    {d.fullName}
                  </Link>
                  {d.majorDonor ? (
                    <span
                      className="ml-2 rounded-full bg-gold-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-dark"
                      title="Major donor"
                    >
                      major
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-black/60">
                  {d.email ?? "—"}
                  {d.phone ? <span className="block text-xs text-black/40">{d.phone}</span> : null}
                </td>
                <td className="px-4 py-3 text-black/60">
                  {[d.city, d.state].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={d.bucket === "confirmed" ? "success" : "neutral"}>
                    {BUCKET_LABELS[d.bucket] ?? d.bucket}
                  </Badge>
                  {d.complianceStatus !== "ok" ? (
                    <span className="block text-[10px] text-red-600">
                      {COMPLIANCE_LABELS[d.complianceStatus] ?? d.complianceStatus}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">{currency(d.lifetimeGiving)}</td>
                <td className="px-4 py-3">
                  <Badge tone={d.status === "active" ? "success" : "neutral"}>{d.status}</Badge>
                </td>
                {(canWrite || canAssign || canDelete) ? (
                  <td className="px-4 py-3 text-right">
                    {canAssign && (
                      <button
                        className="mr-3 text-xs text-emerald hover:underline"
                        onClick={() => openAssign(d)}
                      >
                        Assign
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => handleDelete(d.id)}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-black/40">
                  No donors found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      <Pagination page={pageData.page} totalPages={pageData.totalPages} onPageChange={setPage} />

      <Modal open={modalOpen} title="Add donor" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label="Full name">
            <Input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="City">
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </Field>
            <Field label="State">
              <Input
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Address">
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type">
              <Select
                value={form.donorType}
                onChange={(e) => setForm({ ...form, donorType: e.target.value })}
              >
                <option value="individual">Individual</option>
                <option value="family">Family</option>
                <option value="business">Business</option>
                <option value="anonymous">Anonymous</option>
              </Select>
            </Field>
            <Field label="Bucket">
              <Select
                value={form.bucket}
                onChange={(e) => setForm({ ...form, bucket: e.target.value })}
              >
                <option value="confirmed">Confirmed</option>
                <option value="potential">Potential</option>
                <option value="re_registering">Re-registering</option>
              </Select>
            </Field>
          </div>
          <Field label="Point of contact">
            <Select
              value={form.assignedToUserId}
              onChange={(e) => setForm({ ...form, assignedToUserId: e.target.value })}
            >
              <option value="">Not assigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.fullName} {m.roleName ? `(${m.roleName})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.majorDonor}
              onChange={(e) => setForm({ ...form, majorDonor: e.target.checked })}
              className="h-4 w-4 accent-emerald-700"
            />
            Major donor (high value)
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save donor"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={assignDonor !== null}
        title={`Assign ${assignDonor?.fullName ?? "donor"}`}
        onClose={() => setAssignDonor(null)}
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-black/70">Current assignments</p>
            {assignments.length === 0 ? (
              <p className="text-sm text-black/40">No ambassadors assigned yet.</p>
            ) : (
              <ul className="space-y-1">
                {assignments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-lg bg-black/5 px-3 py-2 text-sm"
                  >
                    <span>{a.ambassadorName ?? a.ambassadorUserId}</span>
                    <button
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => removeAssignment(a.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field label="Add ambassador">
                <Select
                  value={selectedAmbassador}
                  onChange={(e) => setSelectedAmbassador(e.target.value)}
                >
                  {assignable.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.fullName} ({m.roleName ?? m.roleCode})
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button type="button" onClick={addAssignment} disabled={!selectedAmbassador}>
              Add
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={importOpen} title="Import donors from CSV" onClose={() => setImportOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm text-black/60">
            Upload a CSV with a header row. Columns are matched by name — it needs a
            <strong> name</strong> column; <strong>email</strong>, <strong>phone</strong>,{" "}
            <strong>city</strong>, <strong>state</strong>, <strong>address</strong>,{" "}
            <strong>type</strong>, and <strong>bucket</strong> are optional. Existing donors
            (same email, or same name and phone) are skipped automatically.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Add all to group (optional)">
              <Input
                value={importGroupName}
                onChange={(e) => setImportGroupName(e.target.value)}
                placeholder='e.g. "Pilot 1200"'
              />
            </Field>
            <Field label="Default bucket (optional)">
              <Select
                value={importDefaultBucket}
                onChange={(e) => setImportDefaultBucket(e.target.value)}
              >
                <option value="">Keep default (confirmed)</option>
                <option value="confirmed">Confirmed</option>
                <option value="potential">Potential</option>
                <option value="re_registering">Re-registering</option>
              </Select>
            </Field>
          </div>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleImportFile}
            className="block w-full text-sm text-black/60 file:mr-3 file:rounded file:border-0 file:bg-black/5 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-black/10 cursor-pointer"
          />
          {importProblems.length > 0 ? (
            <div className="max-h-32 overflow-y-auto rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {importProblems.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : null}
          {importRows.length > 0 ? (
            <p className="text-sm">
              Ready to import <strong>{importRows.length}</strong> donor
              {importRows.length === 1 ? "" : "s"}
              {importRows.length > 1000 ? " (first 1,000 will be imported)" : ""}.
            </p>
          ) : null}
          {importResult ? (
            <div className="rounded-lg bg-emerald-100 px-3 py-2 text-sm">
              <p>
                Imported <strong>{importResult.imported}</strong>, skipped{" "}
                <strong>{importResult.skipped}</strong> duplicate
                {importResult.skipped === 1 ? "" : "s"}.
              </p>
              {importResult.errors.length > 0 ? (
                <div className="mt-1 max-h-24 overflow-y-auto text-xs text-red-600">
                  {importResult.errors.map((e, i) => (
                    <p key={i}>{e}</p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setImportOpen(false)}>
              {importResult ? "Close" : "Cancel"}
            </Button>
            <Button
              type="button"
              onClick={handleImportSubmit}
              disabled={importing || importRows.length === 0}
            >
              {importing ? "Importing..." : "Import"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={dupOpen} title="Possible duplicate donors" onClose={() => setDupOpen(false)}>
        <div className="space-y-4">
          {dupGroups === null ? (
            <Spinner />
          ) : dupGroups.length === 0 ? (
            <p className="text-sm text-black/50">
              No potential duplicates found. Donors are compared by phone number and by
              normalized name.
            </p>
          ) : (
            <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
              {dupGroups.map((group, gi) => (
                <div key={gi} className="rounded-lg border border-black/10 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/40">
                    {group.reason}
                  </p>
                  <div className="space-y-1">
                    {group.donors.map((d) => (
                      <label
                        key={d.id}
                        className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-emerald-50"
                      >
                        <input
                          type="radio"
                          name={`dup-${gi}`}
                          checked={dupKeep[gi] === d.id}
                          onChange={() => setDupKeep((prev) => ({ ...prev, [gi]: d.id }))}
                        />
                        <span className="font-medium">{d.fullName}</span>
                        <span className="text-black/40">
                          {d.email ?? "no email"} · {d.phone ?? "no phone"} ·{" "}
                          {currency(d.lifetimeGiving)}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-black/40">
                    The selected donor is kept; the others&apos; pledges, payments, notes, and
                    history move to it.
                  </p>
                  {canDelete ? (
                    <div className="mt-2 flex justify-end">
                      <Button
                        type="button"
                        onClick={() => handleMerge(gi)}
                        disabled={merging === gi}
                      >
                        {merging === gi ? "Merging..." : "Merge into selected"}
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-black/40">
                      You need the delete permission to merge donors.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setDupOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
