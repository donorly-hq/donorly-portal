"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { AmbassadorDashboard, Donor, FollowUp } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  PageHeader,
  Spinner,
  StatCard,
  currency,
} from "@/components/ui";

const DAY_MS = 24 * 60 * 60 * 1000;

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Overdue first, then dated tasks soonest-first, then undated. */
function taskOrder(a: FollowUp, b: FollowUp): number {
  const ta = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  const tb = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  return ta - tb;
}

export default function MyShiftPage() {
  const { session, hasPermission } = useAuth();
  const canComplete = hasPermission("followups.write");

  const [data, setData] = useState<AmbassadorDashboard | null>(null);
  const [tasks, setTasks] = useState<FollowUp[] | null>(null);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<AmbassadorDashboard>("/dashboard/my").then(setData).catch((e) => setError(e.message));
    api.get<FollowUp[]>("/follow-ups/mine").then(setTasks).catch(() => setTasks([]));
    api.get<Donor[]>("/donors").then(setDonors).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const donorName = (id: string) => donors.find((d) => d.id === id)?.fullName ?? "Donor";

  const completeTask = async (id: string) => {
    setCompleting(id);
    try {
      await api.patch(`/follow-ups/${id}`, { status: "completed" });
      setTasks((prev) => prev?.filter((t) => t.id !== id) ?? null);
    } finally {
      setCompleting(null);
    }
  };

  if (error) return <p className="p-4 text-red-600">{error}</p>;
  if (!data || !tasks) return <Spinner />;

  const now = Date.now();
  const openTasks = tasks.filter((t) => t.status === "open").sort(taskOrder);
  const overdueCount = openTasks.filter((t) => t.dueAt && new Date(t.dueAt).getTime() < now).length;
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div>
      <PageHeader title="My Shift" subtitle={today} />
      <p className="mb-6 text-sm text-black/50">
        {greeting()}, <span className="font-semibold text-black/70">{session?.fullName}</span>.
        {openTasks.length === 0
          ? " You're all caught up."
          : ` You have ${openTasks.length} open task${openTasks.length === 1 ? "" : "s"}${overdueCount > 0 ? `, ${overdueCount} overdue` : ""}.`}
      </p>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Open tasks" value={openTasks.length} hint={overdueCount > 0 ? `${overdueCount} overdue` : undefined} />
        <StatCard label="My donors" value={data.assignedDonors} />
        <StatCard label="Collected" value={currency(data.totalCollected)} tone="gold" />
        <StatCard label="Outstanding" value={currency(data.outstanding)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* ── Today's tasks ─────────────────────────────────────────────── */}
        <Card className="p-0 xl:col-span-2">
          <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
            <p className="text-sm font-semibold text-black/70">Today&apos;s tasks</p>
            <Link href="/follow-ups" className="text-xs font-semibold text-emerald hover:underline">
              All follow-ups
            </Link>
          </div>
          {openTasks.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
              <p className="text-sm text-black/40">No open tasks — nice work.</p>
              <Link href="/donors">
                <Button size="sm" variant="secondary">Review my donors</Button>
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-black/5">
              {openTasks.map((t) => {
                const overdue = t.dueAt != null && new Date(t.dueAt).getTime() < now;
                const dueToday = t.dueAt != null && !overdue
                  && new Date(t.dueAt).getTime() - now < DAY_MS;
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/donors/${t.donorId}`}
                        className="block truncate text-sm font-medium text-black/80 hover:text-emerald"
                      >
                        {donorName(t.donorId)}
                      </Link>
                      <p className="truncate text-xs text-black/40">{t.notes || "Follow up"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={overdue ? "danger" : dueToday ? "warning" : "neutral"}>
                        {t.dueAt ? (overdue ? "overdue" : dueToday ? "today" : fmtDate(t.dueAt)) : "no date"}
                      </Badge>
                      {canComplete && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={completing === t.id}
                          onClick={() => completeTask(t.id)}
                        >
                          Done
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* ── Coming up ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          <Card className="p-0">
            <div className="border-b border-black/5 px-5 py-3">
              <p className="text-sm font-semibold text-black/70">Upcoming events</p>
            </div>
            {data.upcomingEvents.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-black/40">No upcoming events.</p>
            ) : (
              <ul className="divide-y divide-black/5">
                {data.upcomingEvents.map((e) => (
                  <li key={e.id} className="px-5 py-3">
                    <p className="text-sm font-medium text-black/80">{e.name}</p>
                    <p className="text-xs text-black/40">
                      {fmtDate(e.startsAt)}{e.location ? ` · ${e.location}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-0">
            <div className="border-b border-black/5 px-5 py-3">
              <p className="text-sm font-semibold text-black/70">Upcoming townhalls</p>
            </div>
            {data.upcomingTownhalls.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-black/40">No upcoming townhalls.</p>
            ) : (
              <ul className="divide-y divide-black/5">
                {data.upcomingTownhalls.map((t) => (
                  <li key={t.id} className="px-5 py-3">
                    <p className="text-sm font-medium text-black/80">{t.personName}</p>
                    <p className="text-xs text-black/40">
                      {fmtDate(t.eventDate)}{t.address ? ` · ${t.address}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
