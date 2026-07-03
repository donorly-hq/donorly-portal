"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { MyShift } from "@/lib/types";
import { Badge, Card, PageHeader, Spinner, dateTime } from "@/components/ui";

export default function MyShiftsPage() {
  const [shifts, setShifts] = useState<MyShift[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<MyShift[]>("/my/shifts")
      .then(setShifts)
      .catch((e) => setError(e.message));
  }, []);

  if (error && !shifts) return <p className="text-red-600">{error}</p>;
  if (!shifts) return <Spinner />;

  return (
    <div>
      <PageHeader title="My shifts" subtitle="Volunteer shifts you're assigned to" />

      {shifts.length === 0 ? (
        <Card>
          <p className="text-center text-black/40">You have no volunteer shifts yet.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {shifts.map((s) => (
            <Card key={s.assignmentId}>
              <div className="mb-1 flex items-start justify-between gap-2">
                <h3 className="font-semibold text-emerald">{s.shiftTitle}</h3>
                <Badge tone={s.status === "checked_in" ? "success" : "info"}>
                  {s.status.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="text-sm text-black/50">{dateTime(s.shiftStartsAt)}</p>
              <p className="mt-2 text-sm text-black/60">
                <Link href={`/events/${s.eventId}`} className="text-emerald hover:underline">
                  {s.eventName ?? "Event"}
                </Link>
                {s.eventLocation ? ` · ${s.eventLocation}` : ""}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
