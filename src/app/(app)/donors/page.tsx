"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Assignment, Donor, PageResponse, TeamMember } from "@/lib/types";
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
} from "@/components/ui";

const emptyForm = { fullName: "", email: "", phone: "", city: "", donorType: "individual" };
const PAGE_SIZE = 50;

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

  const [assignDonor, setAssignDonor] = useState<Donor | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignable, setAssignable] = useState<TeamMember[]>([]);
  const [selectedAmbassador, setSelectedAmbassador] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    api
      .get<PageResponse<Donor>>(
        `/donors?page=${page}&size=${PAGE_SIZE}&q=${encodeURIComponent(query)}`,
      )
      .then(setPageData)
      .catch((e) => setError(e.message));
  }, [page, query]);

  useEffect(() => {
    load();
  }, [load]);

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
      await api.post("/donors", form);
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
          canWrite ? <Button onClick={() => setModalOpen(true)}>Add donor</Button> : undefined
        }
      />

      <div className="mb-4 max-w-xs">
        <Input
          placeholder="Search donors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-black/50">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">City</th>
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
                </td>
                <td className="px-4 py-3 text-black/60">
                  {d.email ?? "—"}
                  {d.phone ? <span className="block text-xs text-black/40">{d.phone}</span> : null}
                </td>
                <td className="px-4 py-3 text-black/60">{d.city ?? "—"}</td>
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
                <td colSpan={6} className="px-4 py-10 text-center text-black/40">
                  No donors found.
                </td>
              </tr>
            ) : null}
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
          </div>
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
    </div>
  );
}
