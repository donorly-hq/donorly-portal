"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type {
  EventItem,
  EventRegistration,
  EventSummary,
  TeamMember,
  VolunteerShift,
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
  Textarea,
  dateTime,
  toInstant,
} from "@/components/ui";
import { RequirePermission } from "@/components/RequirePermission";

const emptyGuest = { guestName: "", guestEmail: "", guestPhone: "", partySize: "1", notes: "" };
const emptyShift = { title: "", description: "", startsAt: "", endsAt: "", slots: "1" };

export default function EventDetailPage() {
  return (
    <RequirePermission permission="events.read">
      <EventDetailPageInner />
    </RequirePermission>
  );
}

function EventDetailPageInner() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { hasPermission } = useAuth();
  const canManage = hasPermission("events.manage");
  const canCheckIn = hasPermission("events.checkin");
  const canManageVolunteers = hasPermission("volunteers.manage");

  const [event, setEvent] = useState<EventItem | null>(null);
  const [summary, setSummary] = useState<EventSummary | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [shifts, setShifts] = useState<VolunteerShift[]>([]);
  const [assignable, setAssignable] = useState<TeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [guestOpen, setGuestOpen] = useState(false);
  const [guestForm, setGuestForm] = useState(emptyGuest);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftForm, setShiftForm] = useState(emptyShift);
  const [code, setCode] = useState("");
  const [codeMsg, setCodeMsg] = useState<string | null>(null);

  const [qrReg, setQrReg] = useState<EventRegistration | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrCopied, setQrCopied] = useState(false);

  const checkinUrl = (reg: EventRegistration) =>
    `${window.location.origin}/checkin/${id}/${reg.checkInCode}`;

  const showQr = async (reg: EventRegistration) => {
    setQrReg(reg);
    setQrCopied(false);
    setQrDataUrl(await QRCode.toDataURL(checkinUrl(reg), { width: 280, margin: 1 }));
  };

  const copyQrLink = async () => {
    if (!qrReg) return;
    await navigator.clipboard.writeText(checkinUrl(qrReg));
    setQrCopied(true);
  };

  const load = useCallback(() => {
    Promise.all([
      api.get<EventItem>(`/events/${id}`),
      api.get<EventSummary>(`/events/${id}/summary`),
      api.get<EventRegistration[]>(`/events/${id}/registrations`),
    ])
      .then(([ev, sum, regs]) => {
        setEvent(ev);
        setSummary(sum);
        setRegistrations(regs);
      })
      .catch((e) => setError(e.message));

    if (hasPermission("volunteers.read")) {
      api
        .get<VolunteerShift[]>(`/events/${id}/shifts`)
        .then(setShifts)
        .catch(() => undefined);
    }
    if (canManageVolunteers) {
      api
        .get<TeamMember[]>("/team/assignable")
        .then(setAssignable)
        .catch(() => undefined);
    }
  }, [id, hasPermission, canManageVolunteers]);

  useEffect(() => {
    load();
  }, [load]);

  const registerGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/events/${id}/registrations`, {
        guestName: guestForm.guestName,
        guestEmail: guestForm.guestEmail || null,
        guestPhone: guestForm.guestPhone || null,
        partySize: Number(guestForm.partySize) || 1,
        notes: guestForm.notes || null,
      });
      setGuestForm(emptyGuest);
      setGuestOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register guest");
    }
  };

  const checkIn = async (registrationId: string) => {
    await api.post(`/events/${id}/registrations/${registrationId}/check-in`);
    load();
  };

  const cancelRegistration = async (registrationId: string) => {
    if (!confirm("Cancel this registration?")) return;
    await api.post(`/events/${id}/registrations/${registrationId}/cancel`);
    load();
  };

  const checkInByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeMsg(null);
    try {
      const reg = await api.post<EventRegistration>(
        `/events/${id}/registrations/check-in-by-code`,
        { code },
      );
      setCodeMsg(`Checked in: ${reg.guestName}`);
      setCode("");
      load();
    } catch (err) {
      setCodeMsg(err instanceof Error ? err.message : "Check-in failed");
    }
  };

  const createShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/events/${id}/shifts`, {
        title: shiftForm.title,
        description: shiftForm.description || null,
        startsAt: toInstant(shiftForm.startsAt),
        endsAt: toInstant(shiftForm.endsAt),
        slots: Number(shiftForm.slots) || 1,
      });
      setShiftForm(emptyShift);
      setShiftOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create shift");
    }
  };

  const assignVolunteer = async (shiftId: string, userId: string) => {
    if (!userId) return;
    await api.post(`/shifts/${shiftId}/assignments`, { userId });
    load();
  };

  const checkInVolunteer = async (shiftId: string, assignmentId: string) => {
    await api.post(`/shifts/${shiftId}/assignments/${assignmentId}/check-in`);
    load();
  };

  const removeVolunteer = async (shiftId: string, assignmentId: string) => {
    await api.delete(`/shifts/${shiftId}/assignments/${assignmentId}`);
    load();
  };

  const deleteShift = async (shiftId: string) => {
    if (!confirm("Delete this shift and its assignments?")) return;
    await api.delete(`/shifts/${shiftId}`);
    load();
  };

  if (error && !event) return <p className="text-red-600">{error}</p>;
  if (!event || !summary) return <Spinner />;

  return (
    <div>
      <div className="mb-4">
        <Link href="/events" className="text-sm text-emerald hover:underline">
          &larr; Back to events
        </Link>
      </div>

      <PageHeader
        title={event.name}
        subtitle={dateTime(event.startsAt) + (event.location ? ` · ${event.location}` : "")}
        action={<Badge>{event.status.replace(/_/g, " ")}</Badge>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Registrations" value={summary.registrationCount} />
        <StatCard
          label="Checked in"
          value={summary.checkedInCount}
          hint={`${summary.totalGuests} total guests`}
        />
        <StatCard
          label="Capacity"
          value={event.capacity ?? "—"}
          hint={event.capacity ? `${event.capacity - summary.totalGuests} spots left` : undefined}
        />
        <StatCard
          label="Volunteers"
          value={`${summary.volunteerFilled}/${summary.volunteerSlots}`}
          hint={`${summary.shiftCount} shifts`}
        />
      </div>

      {canCheckIn ? (
        <Card className="mb-6">
          <form onSubmit={checkInByCode} className="flex items-end gap-3">
            <div className="flex-1">
              <Field label="Check in by code (QR / ticket)">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. A1B2C3D4"
                />
              </Field>
            </div>
            <Button type="submit">Check in</Button>
          </form>
          {codeMsg ? <p className="mt-2 text-sm text-emerald">{codeMsg}</p> : null}
        </Card>
      ) : null}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg text-emerald">Registrations</h2>
        {canManage ? (
          <Button variant="secondary" onClick={() => setGuestOpen(true)}>
            Register guest
          </Button>
        ) : null}
      </div>
      <Card className="mb-8 overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-black/50">
              <th className="px-4 py-3 font-medium">Guest</th>
              <th className="px-4 py-3 font-medium">Party</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {registrations.map((r) => (
              <tr key={r.id} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-3">
                  <span className="font-medium text-emerald">{r.guestName}</span>
                  {r.guestEmail ? (
                    <span className="block text-xs text-black/40">{r.guestEmail}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-black/60">{r.partySize}</td>
                <td className="px-4 py-3 font-mono text-xs text-black/50">{r.checkInCode}</td>
                <td className="px-4 py-3">
                  <Badge
                    tone={
                      r.status === "checked_in"
                        ? "success"
                        : r.status === "cancelled"
                          ? "neutral"
                          : "info"
                    }
                  >
                    {r.status.replace(/_/g, " ")}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {r.status !== "cancelled" ? (
                    <button
                      className="mr-3 text-xs text-emerald hover:underline"
                      onClick={() => showQr(r)}
                    >
                      QR
                    </button>
                  ) : null}
                  {canCheckIn && r.status === "registered" ? (
                    <button
                      className="mr-3 text-xs text-emerald hover:underline"
                      onClick={() => checkIn(r.id)}
                    >
                      Check in
                    </button>
                  ) : null}
                  {canManage && r.status !== "cancelled" ? (
                    <button
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => cancelRegistration(r.id)}
                    >
                      Cancel
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {registrations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-black/40">
                  No registrations yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      {hasPermission("volunteers.read") ? (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg text-emerald">Volunteer shifts</h2>
            {canManageVolunteers ? (
              <Button variant="secondary" onClick={() => setShiftOpen(true)}>
                Add shift
              </Button>
            ) : null}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {shifts.map((shift) => (
              <Card key={shift.id}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-emerald">{shift.title}</h3>
                    <p className="text-xs text-black/40">
                      {dateTime(shift.startsAt)} · {shift.filled}/{shift.slots} filled
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={shift.filled >= shift.slots ? "success" : "warning"}>
                      {shift.status}
                    </Badge>
                    {canManageVolunteers ? (
                      <button
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => deleteShift(shift.id)}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
                {shift.description ? (
                  <p className="mb-3 text-sm text-black/50">{shift.description}</p>
                ) : null}

                <ul className="mb-3 space-y-1">
                  {shift.assignments
                    .filter((a) => a.status !== "cancelled")
                    .map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between rounded-lg bg-black/5 px-3 py-2 text-sm"
                      >
                        <span>
                          {a.userName ?? a.userId}
                          {a.status === "checked_in" ? (
                            <Badge tone="success">in</Badge>
                          ) : null}
                        </span>
                        {canManageVolunteers ? (
                          <span className="flex gap-3">
                            {a.status !== "checked_in" ? (
                              <button
                                className="text-xs text-emerald hover:underline"
                                onClick={() => checkInVolunteer(shift.id, a.id)}
                              >
                                Check in
                              </button>
                            ) : null}
                            <button
                              className="text-xs text-red-600 hover:underline"
                              onClick={() => removeVolunteer(shift.id, a.id)}
                            >
                              Remove
                            </button>
                          </span>
                        ) : null}
                      </li>
                    ))}
                </ul>

                {canManageVolunteers && shift.filled < shift.slots ? (
                  <Select
                    defaultValue=""
                    onChange={(e) => {
                      assignVolunteer(shift.id, e.target.value);
                      e.target.value = "";
                    }}
                  >
                    <option value="">Assign volunteer…</option>
                    {assignable.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.fullName}
                      </option>
                    ))}
                  </Select>
                ) : null}
              </Card>
            ))}
            {shifts.length === 0 ? (
              <Card>
                <p className="text-center text-black/40">No volunteer shifts yet.</p>
              </Card>
            ) : null}
          </div>
        </>
      ) : null}

      <Modal
        open={qrReg !== null}
        title="Self-check-in QR"
        onClose={() => { setQrReg(null); setQrDataUrl(null); }}
      >
        {qrReg ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-black/60">
              Send this to <strong>{qrReg.guestName}</strong> (or print it on their ticket).
              Scanning it opens a self-check-in page — no app, no line at the door.
            </p>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`Check-in QR for ${qrReg.guestName}`}
                className="mx-auto rounded-lg border border-black/10"
              />
            ) : (
              <Spinner />
            )}
            <p className="font-mono text-sm text-black/50">{qrReg.checkInCode}</p>
            <div className="flex justify-center gap-2">
              <Button type="button" variant="secondary" onClick={copyQrLink}>
                {qrCopied ? "Link copied!" : "Copy link"}
              </Button>
              <Button type="button" onClick={() => { setQrReg(null); setQrDataUrl(null); }}>
                Done
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={guestOpen} title="Register guest" onClose={() => setGuestOpen(false)}>
        <form onSubmit={registerGuest} className="space-y-4">
          <Field label="Guest name">
            <Input
              value={guestForm.guestName}
              onChange={(e) => setGuestForm({ ...guestForm, guestName: e.target.value })}
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <Input
                type="email"
                value={guestForm.guestEmail}
                onChange={(e) => setGuestForm({ ...guestForm, guestEmail: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={guestForm.guestPhone}
                onChange={(e) => setGuestForm({ ...guestForm, guestPhone: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Party size">
            <Input
              type="number"
              min={1}
              value={guestForm.partySize}
              onChange={(e) => setGuestForm({ ...guestForm, partySize: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <Textarea
              rows={2}
              value={guestForm.notes}
              onChange={(e) => setGuestForm({ ...guestForm, notes: e.target.value })}
            />
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setGuestOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Register</Button>
          </div>
        </form>
      </Modal>

      <Modal open={shiftOpen} title="Add volunteer shift" onClose={() => setShiftOpen(false)}>
        <form onSubmit={createShift} className="space-y-4">
          <Field label="Title">
            <Input
              value={shiftForm.title}
              onChange={(e) => setShiftForm({ ...shiftForm, title: e.target.value })}
              required
            />
          </Field>
          <Field label="Description">
            <Textarea
              rows={2}
              value={shiftForm.description}
              onChange={(e) => setShiftForm({ ...shiftForm, description: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Starts">
              <Input
                type="datetime-local"
                value={shiftForm.startsAt}
                onChange={(e) => setShiftForm({ ...shiftForm, startsAt: e.target.value })}
              />
            </Field>
            <Field label="Ends">
              <Input
                type="datetime-local"
                value={shiftForm.endsAt}
                onChange={(e) => setShiftForm({ ...shiftForm, endsAt: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Slots">
            <Input
              type="number"
              min={1}
              value={shiftForm.slots}
              onChange={(e) => setShiftForm({ ...shiftForm, slots: e.target.value })}
            />
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShiftOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add shift</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
