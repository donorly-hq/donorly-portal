"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Donor, FollowUp } from "@/lib/types";
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
  Textarea,
} from "@/components/ui";

const emptyForm = { donorId: "", dueAt: "", notes: "" };

export default function FollowUpsPage() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("followups.write");
  const [items, setItems] = useState<FollowUp[] | null>(null);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    Promise.all([api.get<FollowUp[]>("/follow-ups"), api.get<Donor[]>("/donors")])
      .then(([f, d]) => {
        setItems(f);
        setDonors(d);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const donorName = (id: string) => donors.find((d) => d.id === id)?.fullName ?? "Unknown donor";

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/follow-ups", {
        donorId: form.donorId,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
        notes: form.notes || undefined,
      });
      setForm(emptyForm);
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save follow-up");
    } finally {
      setSaving(false);
    }
  };

  const complete = async (item: FollowUp) => {
    await api.patch(`/follow-ups/${item.id}`, { status: "completed" });
    load();
  };

  if (error && !items) return <p className="text-red-600">{error}</p>;
  if (!items) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        subtitle={`${items.filter((i) => i.status === "open").length} open`}
        action={
          canWrite ? (
            <Button onClick={() => setModalOpen(true)} disabled={donors.length === 0}>
              New follow-up
            </Button>
          ) : undefined
        }
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-black/50">
              <th className="px-4 py-3 font-medium">Donor</th>
              <th className="px-4 py-3 font-medium">Due</th>
              <th className="px-4 py-3 font-medium">Notes</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {canWrite ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-3 font-medium text-emerald">{donorName(i.donorId)}</td>
                <td className="px-4 py-3 text-black/60">
                  {i.dueAt ? new Date(i.dueAt).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3 text-black/60">{i.notes ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={i.status === "completed" ? "success" : "warning"}>{i.status}</Badge>
                </td>
                {canWrite ? (
                  <td className="px-4 py-3 text-right">
                    {i.status === "open" ? (
                      <button
                        className="text-xs text-emerald hover:underline"
                        onClick={() => complete(i)}
                      >
                        Complete
                      </button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-black/40">
                  No follow-ups yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      <Modal open={modalOpen} title="New follow-up" onClose={() => setModalOpen(false)}>
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
          <Field label="Due date">
            <Input
              type="date"
              value={form.dueAt}
              onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Create follow-up"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
