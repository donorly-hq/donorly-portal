"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { TeamMember, Townhall } from "@/lib/types";
import {
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

const emptyForm = {
  personName: "",
  phone: "",
  venue: "",
  address: "",
  eventDate: "",
  eventTime: "",
  durationMinutes: "60",
  hostAmbassadorUserId: "",
  expectedRsvps: "",
  notes: "",
};

type FormState = typeof emptyForm;

function toForm(t: Townhall): FormState {
  return {
    personName: t.personName,
    phone: t.phone ?? "",
    venue: t.venue ?? "",
    address: t.address ?? "",
    eventDate: t.eventDate ?? "",
    eventTime: t.eventTime ? t.eventTime.slice(0, 5) : "",
    durationMinutes: t.durationMinutes != null ? String(t.durationMinutes) : "60",
    hostAmbassadorUserId: t.hostAmbassadorUserId ?? "",
    expectedRsvps: t.expectedRsvps != null ? String(t.expectedRsvps) : "",
    notes: t.notes ?? "",
  };
}

function formatDuration(minutes: number | null): string {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export default function TownhallsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("townhalls.manage");

  const [townhalls, setTownhalls] = useState<Townhall[] | null>(null);
  const [ambassadors, setAmbassadors] = useState<TeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api.get<Townhall[]>("/townhalls"),
      api.get<TeamMember[]>("/team/assignable"),
    ])
      .then(([t, members]) => {
        setTownhalls(t);
        setAmbassadors(members.filter((m) => m.roleCode === "ambassador"));
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (t: Townhall) => {
    setEditingId(t.id);
    setForm(toForm(t));
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      personName: form.personName,
      phone: form.phone || null,
      venue: form.venue || null,
      address: form.address || null,
      eventDate: form.eventDate || null,
      eventTime: form.eventTime || null,
      durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null,
      hostAmbassadorUserId: form.hostAmbassadorUserId || null,
      expectedRsvps: form.expectedRsvps ? Number(form.expectedRsvps) : null,
      notes: form.notes || null,
    };
    try {
      if (editingId) {
        await api.put(`/townhalls/${editingId}`, payload);
      } else {
        await api.post("/townhalls", payload);
      }
      setModalOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save townhall");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this townhall?")) return;
    await api.delete(`/townhalls/${id}`);
    load();
  };

  if (error && !townhalls) return <p className="text-red-600">{error}</p>;
  if (!townhalls) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Townhalls"
        subtitle={`${townhalls.length} townhall${townhalls.length === 1 ? "" : "s"}`}
        action={canManage ? <Button onClick={openCreate}>Schedule Town Hall</Button> : undefined}
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-black/50">
              <th className="px-4 py-3 font-medium">Responsible Person</th>
              <th className="px-4 py-3 font-medium">Venue</th>
              <th className="px-4 py-3 font-medium">Address</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">RSVPs</th>
              {canManage ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {townhalls.map((t) => {
              const host = ambassadors.find((a) => a.userId === t.hostAmbassadorUserId);
              return (
                <tr key={t.id} className="border-b border-black/5 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-emerald">{t.personName}</p>
                    {t.phone && <p className="text-xs text-black/40">{t.phone}</p>}
                    {host && <p className="text-xs text-black/40">Host: {host.fullName}</p>}
                  </td>
                  <td className="px-4 py-3 text-black/60">{t.venue ?? "—"}</td>
                  <td className="px-4 py-3 text-black/60">{t.address ?? "—"}</td>
                  <td className="px-4 py-3 text-black/60">
                    {t.eventDate ? new Date(t.eventDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-black/60">
                    {t.eventTime ? t.eventTime.slice(0, 5) : "—"}
                  </td>
                  <td className="px-4 py-3 text-black/60">{formatDuration(t.durationMinutes)}</td>
                  <td className="px-4 py-3 text-black/60">{t.expectedRsvps ?? "—"}</td>
                  {canManage ? (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        className="mr-3 text-xs text-emerald hover:underline"
                        onClick={() => openEdit(t)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => handleDelete(t.id)}
                      >
                        Delete
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {townhalls.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 8 : 7} className="px-4 py-10 text-center text-black/40">
                  No townhalls yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      <Modal
        open={modalOpen}
        title={editingId ? "Edit Town Hall" : "Schedule Town Hall"}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSave} className="space-y-4">

          <div className="grid grid-cols-2 gap-4">
            <Field label="Responsible Person *">
              <Input
                value={form.personName}
                onChange={set("personName")}
                placeholder="Who's organizing this"
                required
              />
            </Field>
            <Field label="Their Phone">
              <Input
                value={form.phone}
                onChange={set("phone")}
                placeholder="+1 555 000 0000"
              />
            </Field>
          </div>

          <Field label="Venue">
            <Input
              value={form.venue}
              onChange={set("venue")}
              placeholder="e.g. Community Hall"
            />
          </Field>

          <Field label="Address">
            <Input
              value={form.address}
              onChange={set("address")}
              placeholder="Street, City, State, ZIP"
            />
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Date *">
              <Input
                type="date"
                value={form.eventDate}
                onChange={set("eventDate")}
                required
              />
            </Field>
            <Field label="Time">
              <Input
                type="time"
                value={form.eventTime}
                onChange={set("eventTime")}
              />
            </Field>
            <Field label="Duration (min)">
              <Input
                type="number"
                min={1}
                value={form.durationMinutes}
                onChange={set("durationMinutes")}
                placeholder="60"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Host Ambassador">
              <Select value={form.hostAmbassadorUserId} onChange={set("hostAmbassadorUserId")}>
                <option value="">No ambassador</option>
                {ambassadors.map((a) => (
                  <option key={a.userId} value={a.userId}>{a.fullName}</option>
                ))}
              </Select>
            </Field>
            <Field label="Expected RSVPs">
              <Input
                type="number"
                min={0}
                value={form.expectedRsvps}
                onChange={set("expectedRsvps")}
                placeholder="20"
              />
            </Field>
          </div>

          <Field label="Notes">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={set("notes")}
              placeholder="Any additional details..."
            />
          </Field>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingId ? "Save changes" : "Schedule Town Hall"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
