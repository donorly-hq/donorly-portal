"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { SuggestedReminder } from "@/lib/types";
import { Button, Card, Modal, currency } from "@/components/ui";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

/**
 * Proactive pledge reminders with an approval gate: the backend proposes who
 * to nudge (same rules as the nightly job) and shows the exact email; nothing
 * is sent until a human clicks Send.
 */
export function SuggestedRemindersCard() {
  const { hasPermission } = useAuth();
  const canSend = hasPermission("pledges.write");

  const [reminders, setReminders] = useState<SuggestedReminder[] | null>(null);
  const [reviewing, setReviewing] = useState<SuggestedReminder | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<SuggestedReminder[]>("/pledges/suggested-reminders")
      .then(setReminders)
      .catch(() => setReminders([]));
  }, []);

  const send = async (reminder: SuggestedReminder) => {
    setSending(true);
    setError(null);
    try {
      await api.post(`/pledges/${reminder.pledgeId}/remind`);
      setReminders((prev) => prev?.filter((r) => r.pledgeId !== reminder.pledgeId) ?? null);
      setReviewing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send reminder");
    } finally {
      setSending(false);
    }
  };

  if (!reminders || reminders.length === 0) return null;

  return (
    <>
      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
          <p className="text-sm font-semibold text-black/70">Suggested pledge reminders</p>
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            {reminders.length}
          </span>
        </div>
        <ul className="divide-y divide-black/5">
          {reminders.slice(0, 5).map((r) => (
            <li key={r.pledgeId} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-black/80">{r.donorName}</p>
                <p className="text-xs text-black/40">
                  {currency(r.outstanding)} outstanding · {r.campaignName} ·{" "}
                  {r.lastReminderAt ? `last reminded ${fmtDate(r.lastReminderAt)}` : "never reminded"}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setReviewing(r)}>
                Review
              </Button>
            </li>
          ))}
        </ul>
        {reminders.length > 5 && (
          <p className="border-t border-black/5 px-5 py-2 text-xs text-black/40">
            +{reminders.length - 5} more pledges could use a reminder
          </p>
        )}
      </Card>

      <Modal
        open={reviewing !== null}
        title="Review reminder email"
        onClose={() => setReviewing(null)}
      >
        {reviewing && (
          <div className="space-y-4">
            <div className="text-sm">
              <p><span className="text-black/50">To:</span> {reviewing.donorName} &lt;{reviewing.donorEmail}&gt;</p>
              <p><span className="text-black/50">Subject:</span> {reviewing.emailSubject}</p>
            </div>
            <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-black/[0.03] p-4 font-sans text-sm leading-relaxed text-black/70">
              {reviewing.emailBody}
            </pre>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReviewing(null)}>Cancel</Button>
              {canSend ? (
                <Button onClick={() => send(reviewing)} loading={sending}>Send reminder</Button>
              ) : (
                <p className="self-center text-xs text-black/40">You need pledge-write access to send.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
