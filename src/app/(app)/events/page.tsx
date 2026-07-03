"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { EventItem } from "@/lib/types";
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
  dateTime,
  toInstant,
} from "@/components/ui";

const emptyForm = {
  name: "",
  description: "",
  eventType: "general",
  location: "",
  startsAt: "",
  endsAt: "",
  capacity: "",
  status: "draft",
};

function statusTone(status: string): "success" | "warning" | "info" | "neutral" {
  switch (status) {
    case "published":
      return "info";
    case "in_progress":
      return "success";
    case "cancelled":
      return "neutral";
    case "completed":
      return "warning";
    default:
      return "neutral";
  }
}

export default function EventsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("events.manage");
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api
      .get<EventItem[]>("/events")
      .then(setEvents)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/events", {
        name: form.name,
        description: form.description || null,
        eventType: form.eventType,
        location: form.location || null,
        startsAt: toInstant(form.startsAt),
        endsAt: toInstant(form.endsAt),
        capacity: form.capacity ? Number(form.capacity) : null,
        status: form.status,
      });
      setForm(emptyForm);
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save event");
    } finally {
      setSaving(false);
    }
  };

  if (error && !events) return <p className="text-red-600">{error}</p>;
  if (!events) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Events"
        subtitle={`${events.length} event${events.length === 1 ? "" : "s"}`}
        action={canManage ? <Button onClick={() => setModalOpen(true)}>Create event</Button> : undefined}
      />

      {events.length === 0 ? (
        <Card>
          <p className="text-center text-black/40">No events yet.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => (
            <Link key={ev.id} href={`/events/${ev.id}`}>
              <Card className="h-full transition hover:shadow-md">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-emerald">{ev.name}</h3>
                  <Badge tone={statusTone(ev.status)}>{ev.status.replace(/_/g, " ")}</Badge>
                </div>
                <p className="text-sm text-black/50">{dateTime(ev.startsAt)}</p>
                {ev.location ? (
                  <p className="mt-1 text-sm text-black/40">{ev.location}</p>
                ) : null}
                {ev.capacity ? (
                  <p className="mt-3 text-xs text-black/40">Capacity: {ev.capacity}</p>
                ) : null}
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal open={modalOpen} title="Create event" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label="Event name">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <Field label="Description">
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type">
              <Select
                value={form.eventType}
                onChange={(e) => setForm({ ...form, eventType: e.target.value })}
              >
                <option value="general">General</option>
                <option value="gala">Gala</option>
                <option value="townhall">Town hall</option>
                <option value="fundraiser">Fundraiser</option>
                <option value="volunteer_day">Volunteer day</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </Field>
          </div>
          <Field label="Location">
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Starts">
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </Field>
            <Field label="Ends">
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Capacity">
            <Input
              type="number"
              min={0}
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Create event"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
